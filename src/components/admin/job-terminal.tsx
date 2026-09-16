"use client";

import { useEffect, useRef, useState } from "react";

interface JobLog {
  step: string;
  status: string;
  message: string;
  timestamp?: string;
}

interface TerminalJob {
  jobId: string;
  type: string;
  catalogue: { id: string; title: string } | null;
  status: string;
  paused: boolean;
  retryCount: number;
  maxRetries: number;
  error: string | null;
  totalLogs: number;
  logs: JobLog[];
  result: Record<string, unknown>;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

interface WorkerSummary {
  paused: boolean;
  pending: number;
  processing: number;
  retrying: number;
  pausedJobs: number;
  completed: number;
  failed: number;
}

type StateFilter = "all" | "pending" | "running" | "retrying" | "paused" | "done" | "failed";

const ACTIVE = new Set(["PENDING", "RETRYING", "PROCESSING"]);

function timeAgo(iso: string, now: number): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function typeLabel(type: string): string {
  if (type === "GENERATE_ARTICLE") return "Article";
  if (type === "GENERATE_EDITORIAL") return "Éditorial";
  if (type === "PROCESS_CATALOGUE") return "Catalogue";
  if (type === "ANALYZE_PAGE") return "Page";
  if (type === "BACKFILL_PRODUCT_IMAGES") return "Images";
  if (type === "REGENERATE_ORIGINALS") return "Originals";
  return type;
}

function dotClass(status: string): string {
  switch (status) {
    case "PROCESSING":
      return "bg-blue-400 animate-pulse";
    case "PENDING":
      return "bg-gray-400";
    case "RETRYING":
      return "bg-amber-400 animate-pulse";
    case "COMPLETED":
      return "bg-green-400";
    case "FAILED":
      return "bg-red-400";
    default:
      return "bg-gray-400";
  }
}

function badgeClass(status: string): string {
  switch (status) {
    case "PROCESSING":
      return "bg-blue-500/20 text-blue-300";
    case "PENDING":
      return "bg-gray-500/20 text-gray-300";
    case "RETRYING":
      return "bg-amber-500/20 text-amber-300";
    case "COMPLETED":
      return "bg-green-500/20 text-green-300";
    case "FAILED":
      return "bg-red-500/20 text-red-300";
    default:
      return "bg-gray-500/20 text-gray-300";
  }
}

export default function JobTerminal() {
  const [jobs, setJobs] = useState<TerminalJob[]>([]);
  const [worker, setWorker] = useState<WorkerSummary | null>(null);
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<StateFilter>("all");
  // Expanded job → full log history (fetched from the single-job endpoint,
  // which returns every stored step, not just the feed's tail).
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fullLogs, setFullLogs] = useState<Record<string, JobLog[]>>({});
  const logBoxRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    async function fetchJobs() {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/jobs?limit=15");
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.jobs)) setJobs(data.jobs);
        if (data.worker) setWorker(data.worker);
        // Keep the expanded log view live while its job is still active.
        const id = expandedId;
        if (id) {
          try {
            const detail = await fetch(`/api/jobs/${id}`);
            if (detail.ok) {
              const body = await detail.json();
              const logs = body.result?.logs;
              if (Array.isArray(logs)) {
                setFullLogs((prev) => ({ ...prev, [id]: logs }));
              }
            }
          } catch {
            // Best-effort; the feed already shows the tail.
          }
        }
      } catch {
        // Worker terminal is best-effort; ignore transient errors.
      }
    }
    fetchJobs();
    timer = setInterval(() => {
      fetchJobs();
      // Refresh relative times even without new data.
      setTick(Date.now());
    }, 3000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [expandedId]);

  function toggleExpand(jobId: string) {
    setExpandedId((prev) => (prev === jobId ? null : jobId));
  }

  async function control(action: string, jobId?: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/worker/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobId ? { action, jobId } : { action }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && typeof data.paused === "boolean") {
          const paused = data.paused as boolean;
          setWorker((prev) => (prev ? { ...prev, paused } : prev));
        }
      }
    } catch {
      // Best-effort; next poll refreshes.
    } finally {
      setBusy(false);
    }
    // Immediate refresh so buttons respond without waiting for the poll.
    try {
      const res = await fetch("/api/jobs?limit=15");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.jobs)) setJobs(data.jobs);
        if (data.worker) setWorker(data.worker);
      }
    } catch {
      // ignore
    }
  }

  // Auto-scroll the expanded log box to the bottom as new lines arrive,
  // but only when already pinned near the bottom.
  useEffect(() => {
    if (!expandedId) return;
    const box = logBoxRefs.current[expandedId];
    if (!box) return;
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    if (nearBottom) box.scrollTop = box.scrollHeight;
  }, [fullLogs, expandedId]);

  function logColor(status: string): string {
    switch (status) {
      case "completed":
        return "text-green-400";
      case "error":
        return "text-red-400";
      case "in_progress":
        return "text-blue-300";
      default:
        return "text-gray-400";
    }
  }

  function logTime(iso?: string): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("fr-FR", { hour12: false });
  }

  const activeJobs = jobs.filter((j) => ACTIVE.has(j.status));

  const visibleJobs = jobs.filter((j) => {
    switch (filter) {
      case "pending":
        return j.status === "PENDING" && !j.paused;
      case "running":
        return j.status === "PROCESSING";
      case "retrying":
        return j.status === "RETRYING" && !j.paused;
      case "paused":
        return j.paused && ACTIVE.has(j.status);
      case "done":
        return j.status === "COMPLETED";
      case "failed":
        return j.status === "FAILED";
      default:
        return true;
    }
  });

  function stateChip(key: Exclude<StateFilter, "all">, label: string, count: number | undefined, activeClass: string) {
    const selected = filter === key;
    return (
      <button
        onClick={() => setFilter(selected ? "all" : key)}
        className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors ${
          selected ? activeClass : "bg-gray-800 text-gray-400 hover:bg-gray-700"
        }`}
        title={selected ? "Show all" : `Filter: ${label}`}
      >
        {label} {count ?? 0}
      </button>
    );
  }
  const latestActive = activeJobs[0] ?? null;
  const latestActiveLog = latestActive?.logs?.length
    ? latestActive.logs[latestActive.logs.length - 1]
    : null;

  const newestUpdate = jobs.length
    ? Math.max(...jobs.map((j) => new Date(j.updatedAt).getTime()))
    : 0;
  const stalled = activeJobs.length > 0 && tick - newestUpdate > 90 * 1000;

  const ticker = latestActive
    ? latestActiveLog
      ? `${typeLabel(latestActive.type)} · ${latestActiveLog.message}`.slice(0, 90)
      : `${typeLabel(latestActive.type)} · ${latestActive.status.toLowerCase()}...`
    : jobs.length > 0 && jobs[0].status === "FAILED"
      ? `Last job failed: ${(jobs[0].error || "unknown error").slice(0, 80)}`
      : "Workers idle";

  return (
    <div className="fixed bottom-4 right-4 z-40 font-mono">
      {open && (
        <div className="mb-2 w-[26rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-700 bg-gray-950 text-gray-200 shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
              <span className="flex gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
              </span>
              Workers
              {activeJobs.length > 0 && (
                <span className="rounded-full bg-blue-600 px-1.5 py-px text-[10px] font-bold text-white">
                  {activeJobs.length} active
                </span>
              )}
              {worker?.paused && (
                <span className="rounded bg-amber-500/20 px-1.5 py-px text-[10px] font-bold text-amber-300">
                  paused
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-gray-200 text-lg leading-none"
              title="Collapse"
            >
              ×
            </button>
          </div>
          <div className="flex items-center gap-1.5 border-b border-gray-800 px-3 py-1.5 text-[11px]">
            <button
              onClick={() => control(worker?.paused ? "resume-worker" : "pause-worker")}
              disabled={busy}
              className={`rounded px-2 py-1 font-bold transition-colors disabled:opacity-40 ${
                worker?.paused
                  ? "bg-green-600 text-white hover:bg-green-500"
                  : "bg-amber-600 text-white hover:bg-amber-500"
              }`}
              title={worker?.paused ? "Resume the worker" : "Pause the worker (claims nothing new)"}
            >
              {worker?.paused ? "▶ Worker" : "⏸ Worker"}
            </button>
            <button
              onClick={() => control("pause-all")}
              disabled={busy}
              className="rounded bg-gray-700 px-2 py-1 font-bold text-gray-200 hover:bg-gray-600 disabled:opacity-40"
              title="Pause all queued jobs (running jobs finish)"
            >
              ⏸ All
            </button>
            <button
              onClick={() => control("resume-all")}
              disabled={busy}
              className="rounded bg-gray-700 px-2 py-1 font-bold text-gray-200 hover:bg-gray-600 disabled:opacity-40"
              title="Resume all paused jobs"
            >
              ▶ All
            </button>
            {worker && (
              <span className="ml-auto text-[10px] text-gray-500">
                {worker.pending} pending · {worker.processing} running
                {worker.pausedJobs > 0 ? ` · ${worker.pausedJobs} paused` : ""}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1 border-b border-gray-800 px-3 py-1.5">
            {stateChip("pending", "Pending", worker?.pending, "bg-gray-500 text-white")}
            {stateChip("running", "Running", worker?.processing, "bg-blue-600 text-white")}
            {stateChip("retrying", "Retrying", worker?.retrying, "bg-amber-600 text-white")}
            {stateChip("paused", "Paused", worker?.pausedJobs, "bg-purple-600 text-white")}
            {stateChip("done", "Done", worker?.completed, "bg-green-600 text-white")}
            {stateChip("failed", "Failed", worker?.failed, "bg-red-600 text-white")}
          </div>
          <div className="max-h-72 overflow-y-auto p-2 space-y-1.5">
            {jobs.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-gray-500">
                No jobs yet — queue one from Catalogues (Start / Generate).
              </p>
            )}
            {jobs.length > 0 && visibleJobs.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-gray-500">
                No {filter} jobs in the recent list.
              </p>
            )}
            {visibleJobs.map((job) => {
              const last = job.logs?.length ? job.logs[job.logs.length - 1] : null;
              const expanded = expandedId === job.jobId;
              const history = fullLogs[job.jobId] ?? job.logs;
              return (
                <div key={job.jobId} className="rounded-lg bg-gray-900 px-2.5 py-2 text-xs">
                  <div
                    className="flex w-full cursor-pointer items-center gap-2 text-left"
                    onClick={() => toggleExpand(job.jobId)}
                    title={expanded ? "Collapse logs" : "Expand full logs"}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass(job.status)}`} />
                    <span className="font-bold text-gray-100">
                      {typeLabel(job.type)}
                    </span>
                    {job.catalogue && (
                      <span className="truncate text-gray-400" title={job.catalogue.title}>
                        {job.catalogue.title}
                      </span>
                    )}
                    <span className={`ml-auto shrink-0 rounded px-1.5 py-px text-[10px] font-bold ${badgeClass(job.status)}`}>
                      {job.status}
                      {job.status === "RETRYING" ? ` ${job.retryCount}/${job.maxRetries}` : ""}
                    </span>
                    {job.paused && ACTIVE.has(job.status) && (
                      <span className="shrink-0 rounded bg-purple-500/20 px-1.5 py-px text-[10px] font-bold text-purple-300">
                        paused
                      </span>
                    )}
                    {ACTIVE.has(job.status) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          control(job.paused ? "resume-job" : "pause-job", job.jobId);
                        }}
                        className="shrink-0 cursor-pointer rounded bg-gray-700 px-1.5 py-px text-[10px] font-bold text-gray-200 hover:bg-gray-600"
                        title={job.paused ? "Resume this job" : "Pause this job (running jobs finish first)"}
                      >
                        {job.paused ? "▶" : "⏸"}
                      </button>
                    )}
                    <span className="shrink-0 text-gray-500">{expanded ? "▾" : "▸"}</span>
                  </div>
                  {expanded ? (
                    <div
                      ref={(el) => {
                        logBoxRefs.current[job.jobId] = el;
                      }}
                      className="mt-1.5 max-h-56 space-y-1 overflow-y-auto rounded bg-black/40 p-2"
                    >
                      {history.length === 0 && (
                        <p className="text-[11px] text-gray-500">No steps logged yet.</p>
                      )}
                      {history.map((l, i) => (
                        <p key={i} className="text-[11px] leading-relaxed break-words">
                          <span className="text-gray-600">{logTime(l.timestamp)} </span>
                          <span className={`font-bold ${logColor(l.status)}`}>
                            [{l.status}]
                          </span>{" "}
                          <span className="text-gray-500">{l.step} › </span>
                          <span className="text-gray-200">{l.message}</span>
                        </p>
                      ))}
                      {job.status === "FAILED" && job.error && (
                        <p className="text-[11px] leading-relaxed break-words text-red-400">
                          Error: {job.error}
                        </p>
                      )}
                    </div>
                  ) : (
                    (last || job.error) && (
                      <p className="mt-1 truncate text-[11px] text-gray-400" title={last ? `[${last.status}] ${last.step}: ${last.message}` : job.error || ""}>
                        {last ? (
                          <><span className="text-gray-500">{last.step} › </span>{last.message}</>
                        ) : (
                          <span className="text-red-400">{job.error}</span>
                        )}
                      </p>
                    )
                  )}
                  {job.status === "FAILED" && !expanded && last && job.error && (
                    <p className="mt-0.5 truncate text-[11px] text-red-400" title={job.error}>
                      {job.error}
                    </p>
                  )}
                  <p className="mt-0.5 text-[10px] text-gray-600">
                    {timeAgo(job.updatedAt, tick)}
                    {job.totalLogs > job.logs.length && !expanded ? ` · ${job.totalLogs} steps — expand to read all` : ""}
                    {expanded && job.totalLogs > 0 ? ` · ${job.totalLogs} steps` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="ml-auto flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-gray-700 bg-gray-950 py-2 pl-3 pr-2 text-xs text-gray-200 shadow-2xl hover:border-gray-500 transition-colors"
        title={open ? "Collapse worker terminal" : "Open worker terminal"}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${worker?.paused ? "bg-amber-400" : activeJobs.length > 0 ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
        <span className="font-bold uppercase tracking-wider text-gray-400">Workers</span>
        {worker?.paused && (
          <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-px text-[10px] font-bold text-amber-300">
            paused
          </span>
        )}
        <span className="truncate text-left text-gray-300" style={{ maxWidth: "16rem" }}>
          {stalled ? (
            <span className="text-amber-300">active job, no update for a while — worker running?</span>
          ) : (
            ticker
          )}
        </span>
        {activeJobs.length > 0 && (
          <span className="shrink-0 rounded-full bg-blue-600 px-1.5 py-px text-[10px] font-bold text-white">
            {activeJobs.length}
          </span>
        )}
        <span className="shrink-0 text-gray-500">{open ? "▾" : "▴"}</span>
      </button>
    </div>
  );
}
