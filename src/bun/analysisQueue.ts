/**
 * Priority queue for background audio analysis.
 *
 * - Up to `maxConcurrent` analyses run in parallel (default: 2)
 * - `high` priority items jump to the front of the queue
 * - `pause()` / `resume()` suspend / restart processing
 * - Emits `result` (AnalysisResult) and `error` (AnalysisError) events
 * - Worker is injected via `workerFactory` for testability
 */

import { EventEmitter } from "node:events";

export type AnalysisPriority = "high" | "normal";

export interface AnalysisResult {
  compositeId: string;
  bpm: number | null;
  key: string | null;
  keyCamelot: string | null;
  lufsIntegrated: number;
  lufsPeak: number;
  dynamicRange: number;
}

export interface AnalysisError {
  compositeId: string;
  error: string;
}

export interface QueueStatus {
  pending: number;
  running: number;
  total: number;
}

export interface WorkerLike {
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror?: ((event: { message?: string }) => void) | null;
  postMessage: (msg: unknown) => void;
  terminate?: () => void;
}

export type WorkerFactory = () => WorkerLike;

interface QueueItem {
  compositeId: string;
  path: string;
}

const DEFAULT_MAX_CONCURRENT = 2;

function defaultWorkerFactory(): WorkerLike {
  return new Worker(new URL("./analysisWorker.js", import.meta.url)) as unknown as WorkerLike;
}

export class AnalysisQueue extends EventEmitter {
  private readonly items: QueueItem[] = [];
  private running = 0;
  private paused = false;
  private total = 0;
  private readonly maxConcurrent: number;
  private readonly workerFactory: WorkerFactory;

  constructor(options?: {
    maxConcurrent?: number;
    workerFactory?: WorkerFactory;
  }) {
    super();
    this.maxConcurrent = options?.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
    this.workerFactory = options?.workerFactory ?? defaultWorkerFactory;
  }

  enqueue(compositeId: string, path: string, priority: AnalysisPriority = "normal"): void {
    const item: QueueItem = { compositeId, path };
    if (priority === "high") {
      this.items.unshift(item);
    } else {
      this.items.push(item);
    }
    this.total++;
    this.tick();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.tick();
  }

  getStatus(): QueueStatus {
    return {
      pending: this.items.length,
      running: this.running,
      total: this.total,
    };
  }

  private tick(): void {
    if (this.paused || this.running >= this.maxConcurrent) return;
    const item = this.items.shift();
    if (!item) return;

    this.running++;
    const worker = this.workerFactory();

    worker.onmessage = (event) => {
      this.running--;
      const data = event.data as unknown as { type: string } & (AnalysisResult | AnalysisError);
      if (data.type === "RESULT") {
        this.emit("result", data as AnalysisResult);
      } else {
        this.emit("error", data as AnalysisError);
      }
      worker.terminate?.();
      this.tick();
    };

    worker.onerror = (event) => {
      this.running--;
      this.emit("error", {
        compositeId: item.compositeId,
        error: event.message ?? "Worker crashed",
      } satisfies AnalysisError);
      worker.terminate?.();
      this.tick();
    };

    worker.postMessage({ type: "ANALYZE", ...item });
    this.tick(); // fill remaining concurrent slots
  }
}
