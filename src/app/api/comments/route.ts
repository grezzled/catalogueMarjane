import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🔥", "👎"] as const;

export type CommentTarget = "catalogue" | "article";

// In-memory throttle: 10 comments / 15 min per IP.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_POSTS = 10;
const posts = new Map<string, { count: number; resetAt: number }>();

function throttled(ip: string): boolean {
  const now = Date.now();
  const entry = posts.get(ip);
  if (!entry || now > entry.resetAt) {
    posts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_POSTS;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function isTarget(value: unknown): value is CommentTarget {
  return value === "catalogue" || value === "article";
}

async function targetExists(target: CommentTarget, id: string): Promise<boolean> {
  if (target === "catalogue") {
    const row = await prisma.catalogue.findUnique({ where: { id }, select: { id: true } });
    return !!row;
  }
  const row = await prisma.article.findUnique({ where: { id }, select: { id: true } });
  return !!row;
}

export interface CommentNode {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  reactions: Record<string, number>;
  replies: CommentNode[];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("target");
  const targetId = searchParams.get("id");

  if (!isTarget(target) || !targetId) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }
  if (!(await targetExists(target, targetId))) {
    return NextResponse.json({ error: "Contenu introuvable." }, { status: 404 });
  }

  const where = target === "catalogue" ? { catalogueId: targetId } : { articleId: targetId };
  const [rows, votes] = await Promise.all([
    prisma.comment.findMany({
      where: { ...where, status: "PUBLISHED" },
      orderBy: { createdAt: "asc" },
      select: { id: true, author: true, content: true, createdAt: true, parentId: true },
    }),
    prisma.commentVote.groupBy({
      by: ["commentId", "emoji"],
      where: {
        comment: { ...where, status: "PUBLISHED" },
      },
      _count: { _all: true },
    }),
  ]);

  const reactionsByComment = new Map<string, Record<string, number>>();
  for (const v of votes) {
    const map = reactionsByComment.get(v.commentId) ?? {};
    map[v.emoji] = v._count._all;
    reactionsByComment.set(v.commentId, map);
  }

  const nodes = new Map<string, CommentNode>();
  for (const r of rows) {
    nodes.set(r.id, {
      id: r.id,
      author: r.author,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
      reactions: reactionsByComment.get(r.id) ?? {},
      replies: [],
    });
  }
  const roots: CommentNode[] = [];
  for (const r of rows) {
    const node = nodes.get(r.id)!;
    if (r.parentId && nodes.has(r.parentId)) {
      nodes.get(r.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  return NextResponse.json({ comments: roots, total: rows.length });
}

export async function POST(request: Request) {
  if (throttled(clientIp(request))) {
    return NextResponse.json(
      { error: "Trop de commentaires. Réessayez dans quelques minutes." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const { target, targetId, author, content, parentId } = (body ?? {}) as {
    target?: unknown;
    targetId?: unknown;
    author?: unknown;
    content?: unknown;
    parentId?: unknown;
  };

  if (!isTarget(target) || typeof targetId !== "string" || !targetId) {
    return NextResponse.json({ error: "Cible invalide." }, { status: 400 });
  }
  const name = typeof author === "string" ? author.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > 40) {
    return NextResponse.json({ error: "Indiquez un pseudo entre 2 et 40 caractères." }, { status: 400 });
  }
  const text = typeof content === "string" ? content.trim().replace(/\r/g, "") : "";
  if (text.length < 2 || text.length > 1000) {
    return NextResponse.json({ error: "Le commentaire doit contenir entre 2 et 1000 caractères." }, { status: 400 });
  }
  if (!(await targetExists(target, targetId))) {
    return NextResponse.json({ error: "Contenu introuvable." }, { status: 404 });
  }

  let parent: { id: string; parentId: string | null } | null = null;
  if (parentId !== undefined && parentId !== null) {
    if (typeof parentId !== "string" || !parentId) {
      return NextResponse.json({ error: "Réponse invalide." }, { status: 400 });
    }
    parent = await prisma.comment.findFirst({
      where: {
        id: parentId,
        status: "PUBLISHED",
        ...(target === "catalogue" ? { catalogueId: targetId } : { articleId: targetId }),
      },
      select: { id: true, parentId: true },
    });
    if (!parent) {
      return NextResponse.json({ error: "Commentaire parent introuvable." }, { status: 400 });
    }
  }

  try {
    const created = await prisma.comment.create({
      data: {
        targetType: target,
        catalogueId: target === "catalogue" ? targetId : null,
        articleId: target === "article" ? targetId : null,
        parentId: parent ? parent.id : null,
        author: name,
        content: text,
        status: "PENDING",
      },
      select: { id: true },
    });
    return NextResponse.json({ pending: true, id: created.id }, { status: 201 });
  } catch (error) {
    console.error("Comment create error:", error);
    return NextResponse.json({ error: "Publication impossible pour le moment." }, { status: 500 });
  }
}
