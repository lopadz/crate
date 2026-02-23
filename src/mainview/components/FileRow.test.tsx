import { vi, describe, test, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AudioFile } from "../../shared/types";

const { mockDbSetColorTag } = vi.hoisted(() => ({
  mockDbSetColorTag: vi.fn(),
}));

vi.mock("../rpc", () => ({
  rpcClient: {
    send: { dbSetColorTag: mockDbSetColorTag },
  },
}));

import { FileRow } from "./FileRow";
import { useBrowserStore } from "../stores/browserStore";

const baseFile: AudioFile = {
  path: "/Samples/kick.wav",
  name: "kick.wav",
  extension: ".wav",
  size: 1_048_576, // 1 MB
};

const fileWithMeta: AudioFile = {
  ...baseFile,
  duration: 83, // 1:23
  colorTag: "green",
};

beforeEach(() => {
  vi.clearAllMocks();
  useBrowserStore.setState({
    activeFolder: "/Samples",
    fileList: [baseFile],
    selectedIndex: 0,
    sortKey: "name",
    sortDir: "asc",
    filter: "",
  });
});

describe("FileRow", () => {
  test("renders the file name", () => {
    render(<FileRow file={baseFile} isSelected={false} onClick={() => {}} />);
    expect(screen.getByText("kick.wav")).toBeDefined();
  });

  test("renders the file extension", () => {
    render(<FileRow file={baseFile} isSelected={false} onClick={() => {}} />);
    expect(screen.getByText(".wav")).toBeDefined();
  });

  test("renders formatted size", () => {
    render(<FileRow file={baseFile} isSelected={false} onClick={() => {}} />);
    expect(screen.getByText("1.0 MB")).toBeDefined();
  });

  test("renders formatted duration when available", () => {
    render(<FileRow file={fileWithMeta} isSelected={false} onClick={() => {}} />);
    expect(screen.getByText("1:23")).toBeDefined();
  });

  test("renders dash when duration is unavailable", () => {
    render(<FileRow file={baseFile} isSelected={false} onClick={() => {}} />);
    expect(screen.getByText("—")).toBeDefined();
  });

  test("calls onClick when the row is clicked", async () => {
    const onClick = vi.fn();
    render(<FileRow file={baseFile} isSelected={false} onClick={onClick} />);
    await userEvent.click(screen.getByTestId("file-row"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  test("applies selected styles when isSelected is true", () => {
    render(<FileRow file={baseFile} isSelected={true} onClick={() => {}} />);
    const row = screen.getByTestId("file-row");
    expect(row.className).toContain("selected");
  });

  test("does not apply selected styles when isSelected is false", () => {
    render(<FileRow file={baseFile} isSelected={false} onClick={() => {}} />);
    const row = screen.getByTestId("file-row");
    expect(row.className).not.toContain("selected");
  });

  test("shows green color tag badge", () => {
    render(<FileRow file={{ ...baseFile, colorTag: "green" }} isSelected={false} onClick={() => {}} />);
    expect(screen.getByTestId("color-tag-green")).toBeDefined();
  });

  test("shows yellow color tag badge", () => {
    render(<FileRow file={{ ...baseFile, colorTag: "yellow" }} isSelected={false} onClick={() => {}} />);
    expect(screen.getByTestId("color-tag-yellow")).toBeDefined();
  });

  test("shows red color tag badge", () => {
    render(<FileRow file={{ ...baseFile, colorTag: "red" }} isSelected={false} onClick={() => {}} />);
    expect(screen.getByTestId("color-tag-red")).toBeDefined();
  });

  test("shows no badge when colorTag is null", () => {
    render(<FileRow file={{ ...baseFile, colorTag: null }} isSelected={false} onClick={() => {}} />);
    expect(screen.queryByTestId(/color-tag/)).toBeNull();
  });

  test("accepts a style prop for virtualizer positioning", () => {
    render(
      <FileRow
        file={baseFile}
        isSelected={false}
        onClick={() => {}}
        style={{ position: "absolute", top: 72, height: 36 }}
      />,
    );
    const row = screen.getByTestId("file-row");
    expect(row.style.top).toBe("72px");
  });
});

describe("FileRow — right-click color tagging", () => {
  test("right-clicking the row shows the tag picker", async () => {
    render(<FileRow file={baseFile} isSelected={false} onClick={() => {}} />);
    await userEvent.pointer({ target: screen.getByTestId("file-row"), keys: "[MouseRight]" });
    expect(screen.getByTestId("tag-badge")).toBeDefined();
  });

  test("selecting a color calls rpcClient.send.dbSetColorTag and updates store", async () => {
    render(<FileRow file={baseFile} isSelected={false} onClick={() => {}} />);
    await userEvent.pointer({ target: screen.getByTestId("file-row"), keys: "[MouseRight]" });
    await userEvent.click(screen.getByTestId("tag-option-green"));
    expect(mockDbSetColorTag).toHaveBeenCalledWith({ path: baseFile.path, color: "green" });
    expect(useBrowserStore.getState().fileList[0].colorTag).toBe("green");
  });

  test("selecting none clears the tag", async () => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      fileList: [{ ...baseFile, colorTag: "red" }],
    });
    render(<FileRow file={{ ...baseFile, colorTag: "red" }} isSelected={false} onClick={() => {}} />);
    await userEvent.pointer({ target: screen.getByTestId("file-row"), keys: "[MouseRight]" });
    await userEvent.click(screen.getByTestId("tag-option-none"));
    expect(mockDbSetColorTag).toHaveBeenCalledWith({ path: baseFile.path, color: null });
    expect(useBrowserStore.getState().fileList[0].colorTag).toBeNull();
  });

  test("tag picker closes after a selection", async () => {
    render(<FileRow file={baseFile} isSelected={false} onClick={() => {}} />);
    await userEvent.pointer({ target: screen.getByTestId("file-row"), keys: "[MouseRight]" });
    await userEvent.click(screen.getByTestId("tag-option-yellow"));
    expect(screen.queryByTestId("tag-badge")).toBeNull();
  });
});
