"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Reply, Send } from "lucide-react";

export type CommentTarget = "catalogue" | "article" | "product";

interface CommentNode {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  reactions: Record<string, number>;
  replies: CommentNode[];
}

interface Props {
  target: CommentTarget;
  targetId: string;
}

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🔥", "👎"];
const QUICK_EMOJIS = ["😀", "😍", "👍", "👏", "😮", "😢", "🔥", "🎉", "💡", "❓"];
const PSEUDO_KEY = "mc-pseudo";
const REACTED_KEY = "mc-reacted";

const AVATAR_GRADIENTS = [
  "from-blue-500 to-cyan-400",
  "from-violet-500 to-purple-400",
  "from-emerald-500 to-teal-400",
  "from-orange-500 to-amber-400",
  "from-rose-500 to-pink-400",
  "from-indigo-500 to-blue-400",
];

function avatarGradient(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${date} à ${time}`;
}

function loadReacted(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(REACTED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object") return parsed as Record<string, string[]>;
  } catch {
    // ignore
  }
  return {};
}

/** Flatten any depth > 1 into the root's reply list (UI is 2 levels). */
function normalize(roots: CommentNode[]): CommentNode[] {
  return roots.map((r) => {
    const flat: CommentNode[] = [];
    const walk = (nodes: CommentNode[]) => {
      for (const n of nodes) {
        flat.push({ ...n, replies: [] });
        if (n.replies.length > 0) walk(n.replies);
      }
    };
    walk(r.replies);
    return { ...r, replies: flat };
  });
}

function Composer({
  autoFocus = false,
  submitLabel = "Publier",
  placeholder = "Partagez votre avis, un bon plan repéré…",
  onSubmit,
  submitting,
}: {
  autoFocus?: boolean;
  submitLabel?: string;
  placeholder?: string;
  onSubmit: (author: string, content: string) => Promise<string | null>;
  submitting: boolean;
}) {
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      setAuthor(localStorage.getItem(PSEUDO_KEY) ?? "");
    } catch {
      // ignore
    }
    if (autoFocus) areaRef.current?.focus();
  }, [autoFocus]);

  function insertEmoji(emoji: string) {
    const el = areaRef.current;
    if (!el) {
      setContent((c) => c + emoji);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + emoji + content.slice(end);
    setContent(next.slice(0, 1000));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  async function handleSubmit() {
    setError(null);
    const err = await onSubmit(author.trim(), content.trim());
    if (err) {
      setError(err);
    } else {
      setContent("");
      try {
        localStorage.setItem(PSEUDO_KEY, author.trim());
      } catch {
        // ignore
      }
    }
  }

  return (
    <div>
      <div className="grid gap-3">
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Votre pseudo"
          maxLength={40}
          aria-label="Votre pseudo"
          className="w-full sm:max-w-xs rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
        />
        <div className="rounded-xl border border-gray-200 bg-gray-50 focus-within:border-blue-500 focus-within:bg-white transition-colors overflow-hidden">
          <textarea
            ref={areaRef}
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, 1000))}
            placeholder={placeholder}
            rows={3}
            aria-label="Votre commentaire"
            className="w-full bg-transparent px-3.5 pt-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none resize-y min-h-[76px]"
          />
          <div className="flex items-center gap-1 px-2.5 pb-2 flex-wrap">
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => insertEmoji(e)}
                aria-label={`Insérer ${e}`}
                className="text-lg leading-none rounded-lg px-1.5 py-1 hover:bg-gray-200/70 transition-colors"
              >
                {e}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-gray-400 tabular-nums">{content.length}/1000</span>
          </div>
        </div>
      </div>
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || content.trim().length < 2 || author.trim().length < 2}
        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-default"
      >
        <Send className="h-4 w-4" />
        {submitting ? "Publication…" : submitLabel}
      </button>
    </div>
  );
}

export default function CommentsSection({ target, targetId }: Props) {  const [comments, setComments] = useState<CommentNode[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reacted, setReacted] = useState<Record<string, string[]>>({});
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const [pendingNotice, setPendingNotice] = useState(false);

  useEffect(() => {
    setReacted(loadReacted());
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/comments?target=${target}&id=${encodeURIComponent(targetId)}`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { comments: CommentNode[]; total: number };
        if (!cancelled) {
          setComments(normalize(data.comments ?? []));
          setTotal(data.total ?? 0);
        }
      } catch {
        if (!cancelled) setLoadError("Impossible de charger les commentaires.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [target, targetId]);

  const postComment = useCallback(
    async (parentId: string | null, author: string, content: string): Promise<string | null> => {
      if (author.length < 2 || author.length > 40) return "Indiquez un pseudo entre 2 et 40 caractères.";
      if (content.length < 2 || content.length > 1000) return "Le commentaire doit contenir entre 2 et 1000 caractères.";
      setSubmitting(true);
      try {
        const res = await fetch("/api/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target, targetId, author, content, parentId }),
        });
        const data = (await res.json()) as { pending?: boolean; error?: string };
        if (!res.ok) return data.error ?? "Publication impossible.";
        // Comments require admin approval — never inserted directly.
        setReplyOpen(null);
        setPendingNotice(true);
        return null;
      } catch {
        return "Publication impossible pour le moment.";
      } finally {
        setSubmitting(false);
      }
    },
    [target, targetId]
  );

  async function react(commentId: string, emoji: string) {
    const mine = reacted[commentId] ?? [];
    if (mine.includes(emoji)) return;
    // Optimistic update
    setComments((prev) => {
      const bump = (nodes: CommentNode[]): CommentNode[] =>
        nodes.map((n) => {
          if (n.id === commentId) {
            return { ...n, reactions: { ...n.reactions, [emoji]: (n.reactions[emoji] ?? 0) + 1 } };
          }
          return { ...n, replies: bump(n.replies) };
        });
      return bump(prev);
    });
    try {
      const res = await fetch(`/api/comments/${commentId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { reactions: Record<string, number> };
      setComments((prev) => {
        const apply = (nodes: CommentNode[]): CommentNode[] =>
          nodes.map((n) =>
            n.id === commentId ? { ...n, reactions: data.reactions } : { ...n, replies: apply(n.replies) }
          );
        return apply(prev);
      });
      const next = { ...loadReacted(), [commentId]: [...mine, emoji] };
      setReacted(next);
      try {
        localStorage.setItem(REACTED_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
    } catch {
      // Roll back optimistic bump
      setComments((prev) => {
        const unbump = (nodes: CommentNode[]): CommentNode[] =>
          nodes.map((n) => {
            if (n.id === commentId) {
              const count = (n.reactions[emoji] ?? 1) - 1;
              const reactions = { ...n.reactions };
              if (count <= 0) delete reactions[emoji];
              else reactions[emoji] = count;
              return { ...n, reactions };
            }
            return { ...n, replies: unbump(n.replies) };
          });
        return unbump(prev);
      });
    }
  }

  function renderComment(node: CommentNode, rootId: string, isReply = false) {
    const mine = reacted[node.id] ?? [];
    const replyingToOther = isReply && node.id !== rootId;
    return (
      <div key={node.id} className={isReply ? "mt-3" : ""}>
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={`shrink-0 w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient(node.author)} flex items-center justify-center text-white text-sm font-extrabold`}
          >
            {node.author.charAt(0).toUpperCase()}
          </span>
          <div className="flex-1 min-w-0">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-bold text-gray-900 text-sm">{node.author}</span>
              <span className="text-[11px] text-gray-400">{formatDate(node.createdAt)}</span>
            </p>
            <p className="mt-1 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
              {node.content}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {REACTION_EMOJIS.map((e) => {
                const count = node.reactions[e] ?? 0;
                const active = mine.includes(e);
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() => react(node.id, e)}
                    disabled={active}
                    title={active ? "Vous avez déjà réagi" : `Réagir ${e}`}
                    aria-label={`Réagir ${e}`}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all ${
                      active
                        ? "border-blue-500 bg-blue-50 font-bold"
                        : count > 0
                          ? "border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/50"
                          : "border-transparent opacity-60 hover:opacity-100 hover:bg-gray-100"
                    }`}
                  >
                    <span className="text-sm leading-none">{e}</span>
                    {count > 0 && <span className="tabular-nums text-gray-600">{count}</span>}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setReplyOpen((open) => (open === node.id ? null : node.id))}
                className="ml-1 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-blue-600 transition-colors"
              >
                <Reply className="h-3.5 w-3.5" />
                Répondre
              </button>
            </div>
            {replyOpen === node.id && (
              <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 p-3.5">
                <Composer
                  autoFocus
                  submitLabel="Répondre"
                  placeholder={
                    replyingToOther
                      ? `Répondre à ${node.author}…`
                      : "Écrivez votre réponse…"
                  }
                  submitting={submitting}
                  onSubmit={(author, content) => postComment(rootId, author, content)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section id="commentaires" className="mb-14 scroll-mt-24" aria-label="Commentaires">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-br from-rose-500 to-pink-400 rounded-xl p-2.5 shadow-lg shadow-rose-200">
          <MessageCircle className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Commentaires</h2>
          <p className="text-sm text-gray-500">
            {loading
              ? "Chargement…"
              : total === 0
                ? "Partagez votre avis en premier"
                : `${total} avis de la communauté`}
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 mb-4">
        <Composer submitting={submitting} onSubmit={(author, content) => postComment(null, author, content)} />
      </div>

      {pendingNotice && (
        <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm text-amber-800">
          Merci ! Votre commentaire a bien été envoyé et sera visible après validation par notre équipe. ✅
        </p>
      )}

      {loading ? (
        <div className="space-y-4" aria-label="Chargement des commentaires">
          {[0, 1].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-200" />
                <div className="h-3.5 w-32 rounded bg-gray-200" />
              </div>
              <div className="mt-3 h-3 rounded bg-gray-100 w-full" />
              <div className="mt-2 h-3 rounded bg-gray-100 w-2/3" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <p className="bg-white border border-gray-200 rounded-2xl p-6 text-center text-sm text-gray-500">
          {loadError}
        </p>
      ) : comments.length === 0 ? (
        <p className="bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center text-sm text-gray-500">
          Aucun commentaire pour le moment — lancez la discussion ! 💬
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="bg-white border border-gray-200 rounded-2xl p-5">
              {renderComment(c, c.id)}
              {c.replies.length > 0 && (
                <div className="mt-4 ml-4 sm:ml-6 pl-4 border-l-2 border-gray-100 space-y-4">
                  {c.replies.map((r) => renderComment(r, c.id, true))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Entry-point button placed near the top of catalogue / article / product
 * pages: shows the live comment count, smooth-scrolls to #commentaires
 * and focuses the composer so posting is one click away.
 */
export function CommentCta({
  target,
  targetId,
  prompt = "Donnez votre avis",
  compact = false,
}: {
  target: CommentTarget;
  targetId: string;
  prompt?: string;
  /** Icon + count only — for tight placements like page headers. */
  compact?: boolean;
}) {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/comments?target=${target}&id=${encodeURIComponent(targetId)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setTotal(0);
          return;
        }
        const data = (await res.json().catch(() => null)) as { total?: number } | null;
        setTotal(typeof data?.total === "number" ? data.total : 0);
      })
      .catch(() => {
        if (!cancelled) setTotal(0);
      });
    return () => {
      cancelled = true;
    };
  }, [target, targetId]);

  function go() {
    document.getElementById("commentaires")?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Focus the composer once the scroll lands.
    window.setTimeout(() => {
      const area = document.querySelector<HTMLTextAreaElement>("#commentaires textarea");
      area?.focus({ preventScroll: true });
    }, 650);
  }

  const fullLabel =
    total == null ? prompt : total === 0 ? `${prompt} — soyez le premier !` : `${total} avis · ${prompt.toLowerCase()}`;

  if (compact) {
    return (
      <button
        type="button"
        onClick={go}
        title={fullLabel}
        aria-label={fullLabel}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1.5 text-xs font-bold text-white hover:bg-white/25 transition-colors"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        {total != null && total > 0 ? <span className="tabular-nums">{total}</span> : <span>Avis</span>}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={go}
      className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:border-blue-300 hover:text-blue-700 hover:shadow transition-all"
    >
      <MessageCircle className="h-4 w-4" />
      {fullLabel}
    </button>
  );
}
