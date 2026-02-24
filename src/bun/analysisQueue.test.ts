import { describe, expect, test } from "vitest";
import type { WorkerLike } from "./analysisQueue";
import { AnalysisQueue } from "./analysisQueue";

// ─── Mock worker factory ──────────────────────────────────────────────────────

const RESULT_PAYLOAD = {
  type: "RESULT" as const,
  bpm: 120,
  key: "Am",
  keyCamelot: "8A",
  lufsIntegrated: -14,
  lufsPeak: 0.8,
  dynamicRange: 3,
};

/**
 * Creates a mock WorkerLike that responds to ANALYZE messages.
 * `respond` receives the compositeId and returns the message data to emit.
 */
function makeFactory(
  respond: (compositeId: string) => object,
  delayMs = 0,
): () => WorkerLike {
  return () => {
    const worker: WorkerLike = {
      onmessage: null,
      postMessage(msg: unknown) {
        const { compositeId } = msg as { compositeId: string };
        setTimeout(
          () =>
            worker.onmessage?.({
              data: { ...respond(compositeId), compositeId },
            }),
          delayMs,
        );
      },
      terminate() {},
    };
    return worker;
  };
}

const okFactory = makeFactory(() => RESULT_PAYLOAD);
const errFactory = makeFactory(() => ({
  type: "ERROR",
  error: "decode failed",
}));

// ─── getStatus ────────────────────────────────────────────────────────────────

describe("AnalysisQueue — getStatus", () => {
  test("initial status is all zeros", () => {
    const q = new AnalysisQueue({ workerFactory: okFactory });
    expect(q.getStatus()).toEqual({ pending: 0, running: 0, total: 0 });
  });

  test("total and pending increment on enqueue (while paused)", () => {
    const q = new AnalysisQueue({ workerFactory: okFactory });
    q.pause();
    q.enqueue("cid-a", "/a.wav");
    q.enqueue("cid-b", "/b.wav");
    expect(q.getStatus()).toEqual({ pending: 2, running: 0, total: 2 });
  });
});

// ─── Priority ─────────────────────────────────────────────────────────────────

describe("AnalysisQueue — priority", () => {
  test("high priority items are processed before normal items", async () => {
    const processedOrder: string[] = [];

    const factory = makeFactory((compositeId) => {
      processedOrder.push(compositeId);
      return RESULT_PAYLOAD;
    });

    const q = new AnalysisQueue({ maxConcurrent: 1, workerFactory: factory });
    q.pause();
    q.enqueue("cid-1", "/a.wav", "normal");
    q.enqueue("cid-2", "/b.wav", "normal");
    q.enqueue("cid-3", "/c.wav", "high"); // should jump to front

    const done = new Promise<void>((resolve) => {
      let count = 0;
      q.on("result", () => {
        if (++count === 3) resolve();
      });
    });

    q.resume();
    await done;

    expect(processedOrder[0]).toBe("cid-3"); // high priority first
    expect(processedOrder).toEqual(["cid-3", "cid-1", "cid-2"]); // then FIFO
  });
});

// ─── Pause / resume ───────────────────────────────────────────────────────────

describe("AnalysisQueue — pause / resume", () => {
  test("pause() stops new items from being processed", async () => {
    const processed: string[] = [];

    const factory = makeFactory((compositeId) => {
      processed.push(compositeId);
      return RESULT_PAYLOAD;
    }, 10);

    const q = new AnalysisQueue({ maxConcurrent: 1, workerFactory: factory });
    q.pause();
    q.enqueue("cid-a", "/a.wav");
    q.enqueue("cid-b", "/b.wav");

    await new Promise((r) => setTimeout(r, 30));

    expect(processed).toHaveLength(0);
    expect(q.getStatus().running).toBe(0);
  });

  test("resume() processes items that were enqueued while paused", async () => {
    const processed: string[] = [];

    const factory = makeFactory((compositeId) => {
      processed.push(compositeId);
      return RESULT_PAYLOAD;
    });

    const q = new AnalysisQueue({ maxConcurrent: 1, workerFactory: factory });
    q.pause();
    q.enqueue("cid-a", "/a.wav");
    q.enqueue("cid-b", "/b.wav");

    const done = new Promise<void>((r) => {
      let count = 0;
      q.on("result", () => {
        if (++count === 2) r();
      });
    });

    q.resume();
    await done;

    expect(processed).toHaveLength(2);
  });
});

// ─── Events ───────────────────────────────────────────────────────────────────

describe("AnalysisQueue — events", () => {
  test('emits "result" event with analysis data on success', async () => {
    const q = new AnalysisQueue({ workerFactory: okFactory });
    const resultPromise = new Promise<object>((resolve) =>
      q.once("result", resolve),
    );
    q.enqueue("cid-42", "/file.wav");
    const result = await resultPromise;

    expect((result as Record<string, unknown>).compositeId).toBe("cid-42");
    expect((result as Record<string, unknown>).bpm).toBe(120);
    expect((result as Record<string, unknown>).key).toBe("Am");
  });

  test('emits "error" event on worker failure', async () => {
    const q = new AnalysisQueue({ workerFactory: errFactory });
    q.on("error", () => {});

    const err = await new Promise<object>((resolve) => {
      q.once("error", resolve);
      q.enqueue("cid-broken", "/broken.wav");
    });

    expect((err as Record<string, unknown>).compositeId).toBe("cid-broken");
    expect((err as Record<string, unknown>).error).toBe("decode failed");
  });

  test("queue continues processing after a worker error", async () => {
    let callCount = 0;

    const factory = makeFactory((compositeId) => {
      callCount++;
      return callCount === 1
        ? { type: "ERROR", error: "fail" }
        : { ...RESULT_PAYLOAD, compositeId };
    });

    const q = new AnalysisQueue({ maxConcurrent: 1, workerFactory: factory });
    q.on("error", () => {});

    const events: string[] = [];
    const done = new Promise<void>((resolve) => {
      let total = 0;
      const check = () => {
        if (++total === 2) resolve();
      };
      q.on("error", () => {
        events.push("error");
        check();
      });
      q.on("result", () => {
        events.push("result");
        check();
      });
    });

    q.enqueue("cid-1", "/broken.wav");
    q.enqueue("cid-2", "/good.wav");

    await done;

    expect(events).toContain("error");
    expect(events).toContain("result");
    expect(callCount).toBe(2);
  });
});

// ─── Concurrency ──────────────────────────────────────────────────────────────

describe("AnalysisQueue — concurrency", () => {
  test("respects maxConcurrent limit", async () => {
    let concurrentPeak = 0;
    let concurrent = 0;

    const factory = makeFactory((_compositeId) => {
      concurrent++;
      if (concurrent > concurrentPeak) concurrentPeak = concurrent;
      concurrent--;
      return RESULT_PAYLOAD;
    }, 5);

    const q = new AnalysisQueue({ maxConcurrent: 2, workerFactory: factory });
    const done = new Promise<void>((r) => {
      let count = 0;
      q.on("result", () => {
        if (++count === 4) r();
      });
    });

    q.enqueue("cid-a", "/a.wav");
    q.enqueue("cid-b", "/b.wav");
    q.enqueue("cid-c", "/c.wav");
    q.enqueue("cid-d", "/d.wav");

    await done;

    expect(concurrentPeak).toBeLessThanOrEqual(2);
  });
});
