import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Collection } from "../../shared/types";
import { useCollectionStore } from "../stores/collectionStore";

vi.mock("../rpc", () => ({
  rpcClient: {
    request: {
      dbGetPinnedFolders: vi.fn().mockResolvedValue([]),
      collectionGetAll: vi.fn().mockResolvedValue([]),
      dbGetPlayHistory: vi.fn().mockResolvedValue([]),
    },
    send: {},
  },
}));

import { Sidebar } from "./Sidebar";

const col1: Collection = {
  id: 1,
  name: "Kicks",
  color: "#f00",
  queryJson: null,
};
const col2: Collection = {
  id: 2,
  name: "Bass loops",
  color: null,
  queryJson: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  useCollectionStore.setState({ collections: [], activeCollectionId: null });
});

describe("Sidebar — basic structure", () => {
  test("renders without crashing", () => {
    render(<Sidebar />);
  });

  test("has sidebar test id", () => {
    render(<Sidebar />);
    expect(screen.getByTestId("sidebar")).toBeDefined();
  });
});

describe("Sidebar — collections section", () => {
  test("renders collections section", () => {
    render(<Sidebar />);
    expect(screen.getByTestId("collections-section")).toBeDefined();
  });

  test("shows each collection from the store", () => {
    useCollectionStore.setState({
      collections: [col1, col2],
      activeCollectionId: null,
    });
    render(<Sidebar />);
    expect(screen.getByTestId("collection-item-1")).toBeDefined();
    expect(screen.getByTestId("collection-item-2")).toBeDefined();
  });

  test("shows collection names", () => {
    useCollectionStore.setState({
      collections: [col1],
      activeCollectionId: null,
    });
    render(<Sidebar />);
    expect(screen.getByText("Kicks")).toBeDefined();
  });

  test("renders a delete button for each collection", () => {
    useCollectionStore.setState({
      collections: [col1],
      activeCollectionId: null,
    });
    render(<Sidebar />);
    expect(screen.getByTestId("collection-delete-1")).toBeDefined();
  });

  test("clicking delete calls deleteCollection with the collection id", async () => {
    const deleteCollection = vi.fn().mockResolvedValue(undefined);
    const loadCollections = vi.fn().mockResolvedValue(undefined);
    useCollectionStore.setState({
      collections: [col1],
      activeCollectionId: null,
      deleteCollection,
      loadCollections,
    });
    render(<Sidebar />);
    await userEvent.click(screen.getByTestId("collection-delete-1"));
    expect(deleteCollection).toHaveBeenCalledWith(1);
  });

  test("clicking a collection calls selectCollection", async () => {
    const selectCollection = vi.fn().mockResolvedValue(undefined);
    // Also stub loadCollections so the useEffect doesn't overwrite our test state
    const loadCollections = vi.fn().mockResolvedValue(undefined);
    useCollectionStore.setState({
      collections: [col1],
      activeCollectionId: null,
      selectCollection,
      loadCollections,
    });
    render(<Sidebar />);
    await userEvent.click(screen.getByTestId("collection-item-1"));
    expect(selectCollection).toHaveBeenCalledWith(1);
  });
});
