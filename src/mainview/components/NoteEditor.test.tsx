import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockDbGetNote, mockDbSetNote } = vi.hoisted(() => ({
  mockDbGetNote: vi.fn().mockResolvedValue(null),
  mockDbSetNote: vi.fn(),
}));

vi.mock("../rpc", () => ({
  rpcClient: {
    request: {
      dbGetNote: mockDbGetNote,
    },
    send: {
      dbSetNote: mockDbSetNote,
    },
  },
}));

import { NoteEditor } from "./NoteEditor";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NoteEditor", () => {
  test("renders textarea", () => {
    render(<NoteEditor compositeId="cid-1" />);
    expect(screen.getByTestId("note-editor")).toBeDefined();
  });

  test("loads existing note via dbGetNote on mount", async () => {
    mockDbGetNote.mockResolvedValue("My saved note");
    render(<NoteEditor compositeId="cid-1" />);
    await waitFor(() =>
      expect((screen.getByTestId("note-editor") as HTMLTextAreaElement).value).toBe(
        "My saved note",
      ),
    );
    expect(mockDbGetNote).toHaveBeenCalledWith({ compositeId: "cid-1" });
  });

  test("re-loads note when compositeId changes", async () => {
    mockDbGetNote.mockResolvedValueOnce("Note A").mockResolvedValueOnce("Note B");
    const { rerender } = render(<NoteEditor compositeId="cid-1" />);
    await waitFor(() =>
      expect((screen.getByTestId("note-editor") as HTMLTextAreaElement).value).toBe("Note A"),
    );
    rerender(<NoteEditor compositeId="cid-2" />);
    await waitFor(() =>
      expect((screen.getByTestId("note-editor") as HTMLTextAreaElement).value).toBe("Note B"),
    );
    expect(mockDbGetNote).toHaveBeenCalledWith({ compositeId: "cid-2" });
  });

  test("sends dbSetNote on blur", async () => {
    mockDbGetNote.mockResolvedValue(null);
    render(<NoteEditor compositeId="cid-1" />);
    const textarea = screen.getByTestId("note-editor");
    fireEvent.change(textarea, { target: { value: "New note content" } });
    fireEvent.blur(textarea);
    await waitFor(() =>
      expect(mockDbSetNote).toHaveBeenCalledWith({
        compositeId: "cid-1",
        content: "New note content",
      }),
    );
  });

  test("shows empty textarea when no note exists", async () => {
    mockDbGetNote.mockResolvedValue(null);
    render(<NoteEditor compositeId="cid-1" />);
    await waitFor(() => expect(mockDbGetNote).toHaveBeenCalled());
    expect((screen.getByTestId("note-editor") as HTMLTextAreaElement).value).toBe("");
  });
});
