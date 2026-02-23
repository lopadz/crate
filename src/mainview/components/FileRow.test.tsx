import { vi, describe, test, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AudioFile } from "../../shared/types";
import { FileRow } from "./FileRow";

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

beforeEach(() => vi.clearAllMocks());

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
