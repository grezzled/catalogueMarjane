import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  getWorkerStatus,
  pauseAllJobs,
  pauseJob,
  resumeAllJobs,
  resumeJob,
  setWorkerPaused,
} from "@/services/jobs";

const ACTIONS = [
  "status",
  "pause-worker",
  "resume-worker",
  "pause-all",
  "pause-pending",
  "resume-all",
  "pause-job",
  "resume-job",
] as const;

/**
 * Worker controls (admin-only via middleware):
 * - pause-worker / resume-worker: global kill-switch, worker claims nothing.
 * - pause-all: pause all PENDING + RETRYING jobs (running jobs finish).
 * - pause-pending: pause only PENDING jobs (backoff/RETRYING untouched).
 * - resume-all: unpause everything; backoff timers cleared.
 * - pause-job / resume-job: single job by jobId. resume-job on a RETRYING
 *   job clears its backoff so it runs ASAP.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, jobId } = body as { action?: string; jobId?: string };

    if (!action || !ACTIONS.includes(action as (typeof ACTIONS)[number])) {
      return NextResponse.json(
        { error: `Invalid action. Allowed: ${ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    switch (action) {
      case "status":
        return NextResponse.json({ success: true, ...(await getWorkerStatus()) });

      case "pause-worker":
        await setWorkerPaused(true);
        return NextResponse.json({
          success: true,
          message: "Worker paused — it will finish nothing new until resumed",
          ...(await getWorkerStatus()),
        });

      case "resume-worker":
        await setWorkerPaused(false);
        return NextResponse.json({
          success: true,
          message: "Worker resumed",
          ...(await getWorkerStatus()),
        });

      case "pause-all": {
        const count = await pauseAllJobs(false);
        return NextResponse.json({
          success: true,
          message: `Paused ${count} job(s)`,
          count,
          ...(await getWorkerStatus()),
        });
      }

      case "pause-pending": {
        const count = await pauseAllJobs(true);
        return NextResponse.json({
          success: true,
          message: `Paused ${count} pending job(s)`,
          count,
          ...(await getWorkerStatus()),
        });
      }

      case "resume-all": {
        const count = await resumeAllJobs();
        return NextResponse.json({
          success: true,
          message: `Resumed ${count} job(s)`,
          count,
          ...(await getWorkerStatus()),
        });
      }

      case "pause-job": {
        if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
        const job = await prisma.aIJob.findUnique({
          where: { id: jobId },
          select: { status: true },
        });
        if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
        if (job.status === "PROCESSING") {
          // Can't interrupt a claim; flag it so a crash-recovery won't silently
          // resume it — operator intent is preserved.
          await prisma.aIJob.update({ where: { id: jobId }, data: { paused: true } });
          return NextResponse.json({
            success: true,
            message: "Job is PROCESSING and will finish this run; flagged paused afterwards",
            ...(await getWorkerStatus()),
          });
        }
        const ok = await pauseJob(jobId);
        if (!ok) {
          return NextResponse.json(
            { error: "Job is not pausable (terminal state or already paused)" },
            { status: 400 }
          );
        }
        return NextResponse.json({
          success: true,
          message: "Job paused",
          ...(await getWorkerStatus()),
        });
      }

      case "resume-job": {
        if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
        const ok = await resumeJob(jobId);
        if (!ok) {
          return NextResponse.json(
            { error: "Job not found or not paused" },
            { status: 400 }
          );
        }
        return NextResponse.json({
          success: true,
          message: "Job resumed",
          ...(await getWorkerStatus()),
        });
      }
    }
  } catch (error) {
    console.error("Worker control error:", error);
    return NextResponse.json(
      { error: "Failed to execute worker action" },
      { status: 500 }
    );
  }
}
