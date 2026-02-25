import { beforeEach, describe, expect, test } from "vitest";
import { useAnalysisStore } from "./analysisStore";

beforeEach(() => {
  useAnalysisStore.setState({
    queueStatus: { pending: 0, running: 0, total: 0 },
    fileStatuses: {},
  });
});

describe("analysisStore — queue status", () => {
  test("initial queue status is all zeros", () => {
    expect(useAnalysisStore.getState().queueStatus).toEqual({
      pending: 0,
      running: 0,
      total: 0,
    });
  });

  test("setQueueStatus updates counters", () => {
    useAnalysisStore
      .getState()
      .setQueueStatus({ pending: 3, running: 2, total: 10 });
    expect(useAnalysisStore.getState().queueStatus).toEqual({
      pending: 3,
      running: 2,
      total: 10,
    });
  });
});

describe("analysisStore — per-file status", () => {
  test("initial fileStatuses is empty", () => {
    expect(useAnalysisStore.getState().fileStatuses).toEqual({});
  });

  test("setFileStatus marks a file as queued", () => {
    useAnalysisStore.getState().setFileStatus("cid-1", "queued");
    expect(useAnalysisStore.getState().fileStatuses["cid-1"]).toBe("queued");
  });

  test("setFileStatus marks a file as done", () => {
    useAnalysisStore.getState().setFileStatus("cid-1", "done");
    expect(useAnalysisStore.getState().fileStatuses["cid-1"]).toBe("done");
  });

  test("setFileStatus marks a file as error", () => {
    useAnalysisStore.getState().setFileStatus("cid-1", "error");
    expect(useAnalysisStore.getState().fileStatuses["cid-1"]).toBe("error");
  });

  test("multiple files can have independent statuses", () => {
    useAnalysisStore.getState().setFileStatus("cid-a", "queued");
    useAnalysisStore.getState().setFileStatus("cid-b", "done");
    useAnalysisStore.getState().setFileStatus("cid-c", "error");
    const statuses = useAnalysisStore.getState().fileStatuses;
    expect(statuses["cid-a"]).toBe("queued");
    expect(statuses["cid-b"]).toBe("done");
    expect(statuses["cid-c"]).toBe("error");
  });

  test("status transitions from queued to done", () => {
    useAnalysisStore.getState().setFileStatus("cid-1", "queued");
    useAnalysisStore.getState().setFileStatus("cid-1", "done");
    expect(useAnalysisStore.getState().fileStatuses["cid-1"]).toBe("done");
  });

  test("setFileStatuses sets multiple statuses in one update", () => {
    useAnalysisStore.getState().setFileStatuses({
      "cid-a": "queued",
      "cid-b": "done",
      "cid-c": "error",
    });
    const statuses = useAnalysisStore.getState().fileStatuses;
    expect(statuses["cid-a"]).toBe("queued");
    expect(statuses["cid-b"]).toBe("done");
    expect(statuses["cid-c"]).toBe("error");
  });

  test("setFileStatuses merges with existing statuses", () => {
    useAnalysisStore.getState().setFileStatus("cid-existing", "queued");
    useAnalysisStore.getState().setFileStatuses({ "cid-new": "done" });
    const statuses = useAnalysisStore.getState().fileStatuses;
    expect(statuses["cid-existing"]).toBe("queued");
    expect(statuses["cid-new"]).toBe("done");
  });
});
