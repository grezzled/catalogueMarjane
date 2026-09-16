import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createJob, getActiveJobForCatalogue } from "@/services/jobs";
import {
  getArticleType,
  validateArticleTypeChoice,
} from "@/lib/article-types";

function toJobResponse(job: {
  id: string;
  type: string;
  status: string;
  retryCount: number;
  maxRetries: number;
  errorMessage: string | null;
  result: string | null;
  createdAt: Date;
}) {
  let result: Record<string, unknown> | null = null;
  try {
    result = job.result ? (JSON.parse(job.result) as Record<string, unknown>) : null;
  } catch {
    result = null;
  }
  return {
    jobId: job.id,
    type: job.type,
    status: job.status,
    retryCount: job.retryCount,
    maxRetries: job.maxRetries,
    error: job.errorMessage,
    result,
  };
}

function payloadOf(job: { payload: string | null }): {
  articleType?: string;
  category?: string;
} {
  try {
    return job.payload ? (JSON.parse(job.payload) as { articleType?: string; category?: string }) : {};
  } catch {
    return {};
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const catalogue = await prisma.catalogue.findUnique({
      where: { id },
    });

    if (!catalogue) {
      return NextResponse.json(
        { error: "Catalogue not found" },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const def = getArticleType(
      typeof body.articleType === "string" ? body.articleType : undefined
    );
    const category =
      typeof body.category === "string" && body.category.trim()
        ? body.category.trim()
        : undefined;

    // Refuse thin slices up front — the worker re-validates before saving.
    const refusal = await validateArticleTypeChoice(id, def.id, category, prisma);
    if (refusal) {
      return NextResponse.json({ error: refusal }, { status: 422 });
    }

    // All AI work runs on the worker queue — no synchronous fallback.
    // Idempotency per (type, category): reuse the matching active job
    // instead of queueing duplicates; different intents run in parallel.
    const existing = await getActiveJobForCatalogue(id, "GENERATE_ARTICLE");
    if (existing) {
      const p = payloadOf(existing);
      const sameType = (p.articleType ?? "overview") === def.id;
      const sameCategory = (p.category ?? undefined) === category;
      if (sameType && sameCategory) {
        return NextResponse.json({
          success: true,
          queued: false,
          message: "Article generation already in progress",
          ...toJobResponse(existing),
        });
      }
    }

    const jobId = await createJob(
      "GENERATE_ARTICLE",
      { catalogueId: id, articleType: def.id, ...(category ? { category } : {}) },
      { catalogueId: id }
    );
    const job = await prisma.aIJob.findUnique({ where: { id: jobId } });

    return NextResponse.json(
      {
        success: true,
        queued: true,
        message: `Article generation queued (${def.label}${category ? ` — ${category}` : ""}) — the worker will pick it up`,
        articleType: def.id,
        category: category ?? null,
        ...toJobResponse(job!),
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Error queueing article generation:", error);
    return NextResponse.json(
      { error: "Failed to queue article generation" },
      { status: 500 }
    );
  }
}
