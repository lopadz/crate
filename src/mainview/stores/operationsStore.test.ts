import { beforeEach, describe, expect, test } from "vitest";
import { useOperationsStore } from "./operationsStore";

// ── Helpers ───────────────────────────────────────────────────────────────────

type OperationRecord = {
  id: number;
  operation: string;
  files: Array<{ originalPath: string; newPath: string }>;
  timestamp: number;
  rolledBackAt: number | null;
};

function makeRecord(id: number, operation = "rename"): OperationRecord {
  return {
    id,
    operation,
    files: [{ originalPath: `/src/${id}.wav`, newPath: `/dest/${id}.wav` }],
    timestamp: Date.now(),
    rolledBackAt: null,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  useOperationsStore.setState({ log: [], isUndoing: false, pendingBatchOp: null });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("operationsStore — initial state", () => {
  test("log is empty", () => {
    expect(useOperationsStore.getState().log).toEqual([]);
  });

  test("isUndoing is false", () => {
    expect(useOperationsStore.getState().isUndoing).toBe(false);
  });

  test("pendingBatchOp is null", () => {
    expect(useOperationsStore.getState().pendingBatchOp).toBeNull();
  });
});

describe("operationsStore — setLog", () => {
  test("replaces the entire log", () => {
    const entries = [makeRecord(1), makeRecord(2)];
    useOperationsStore.getState().setLog(entries);
    expect(useOperationsStore.getState().log).toEqual(entries);
  });

  test("setLog([]) clears the log", () => {
    useOperationsStore.getState().setLog([makeRecord(1)]);
    useOperationsStore.getState().setLog([]);
    expect(useOperationsStore.getState().log).toEqual([]);
  });
});

describe("operationsStore — prependEntry", () => {
  test("adds entry to the front of the log", () => {
    const first = makeRecord(1);
    const second = makeRecord(2);
    useOperationsStore.getState().prependEntry(first);
    useOperationsStore.getState().prependEntry(second);
    expect(useOperationsStore.getState().log[0]).toEqual(second);
    expect(useOperationsStore.getState().log[1]).toEqual(first);
  });

  test("prependEntry then setLog([]) results in empty log", () => {
    useOperationsStore.getState().prependEntry(makeRecord(1));
    useOperationsStore.getState().setLog([]);
    expect(useOperationsStore.getState().log).toEqual([]);
  });
});

describe("operationsStore — setUndoing", () => {
  test("setUndoing(true) sets isUndoing to true", () => {
    useOperationsStore.getState().setUndoing(true);
    expect(useOperationsStore.getState().isUndoing).toBe(true);
  });

  test("setUndoing(false) resets isUndoing to false", () => {
    useOperationsStore.getState().setUndoing(true);
    useOperationsStore.getState().setUndoing(false);
    expect(useOperationsStore.getState().isUndoing).toBe(false);
  });
});

describe("operationsStore — setPendingBatchOp", () => {
  test("setPendingBatchOp('rename') sets the field", () => {
    useOperationsStore.getState().setPendingBatchOp("rename");
    expect(useOperationsStore.getState().pendingBatchOp).toBe("rename");
  });

  test("setPendingBatchOp(null) clears the field", () => {
    useOperationsStore.getState().setPendingBatchOp("convert");
    useOperationsStore.getState().setPendingBatchOp(null);
    expect(useOperationsStore.getState().pendingBatchOp).toBeNull();
  });
});
