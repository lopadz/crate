import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { useAnalysisStore } from "../stores/analysisStore";
import { useFileAnalysisStatus } from "./useFileAnalysisStatus";

const ID = "folder::file.wav";

beforeEach(() => {
  useAnalysisStore.setState({
    queueStatus: { pending: 0, running: 0, total: 0 },
    fileStatuses: {},
  });
});

describe("useFileAnalysisStatus", () => {
  test("returns undefined when compositeId is undefined", () => {
    const { result } = renderHook(() => useFileAnalysisStatus(undefined));
    expect(result.current).toBeUndefined();
  });

  test("returns undefined when compositeId has no entry in the store", () => {
    const { result } = renderHook(() => useFileAnalysisStatus(ID));
    expect(result.current).toBeUndefined();
  });

  test("returns 'queued' when the file is queued", () => {
    useAnalysisStore.setState({ fileStatuses: { [ID]: "queued" } });
    const { result } = renderHook(() => useFileAnalysisStatus(ID));
    expect(result.current).toBe("queued");
  });

  test("returns 'done' when analysis is complete", () => {
    useAnalysisStore.setState({ fileStatuses: { [ID]: "done" } });
    const { result } = renderHook(() => useFileAnalysisStatus(ID));
    expect(result.current).toBe("done");
  });

  test("returns 'error' when analysis failed", () => {
    useAnalysisStore.setState({ fileStatuses: { [ID]: "error" } });
    const { result } = renderHook(() => useFileAnalysisStatus(ID));
    expect(result.current).toBe("error");
  });

  test("updates reactively when status changes", () => {
    const { result } = renderHook(() => useFileAnalysisStatus(ID));
    expect(result.current).toBeUndefined();
    act(() => useAnalysisStore.setState({ fileStatuses: { [ID]: "queued" } }));
    expect(result.current).toBe("queued");
    act(() => useAnalysisStore.setState({ fileStatuses: { [ID]: "done" } }));
    expect(result.current).toBe("done");
  });
});
