import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AudioFile, Collection } from "../../shared/types";

const { mockCollectionGetAll, mockCollectionCreate, mockCollectionGetFiles, mockCollectionDelete } =
  vi.hoisted(() => ({
    mockCollectionGetAll: vi.fn(),
    mockCollectionCreate: vi.fn(),
    mockCollectionGetFiles: vi.fn(),
    mockCollectionDelete: vi.fn(),
  }));

vi.mock("../rpc", () => ({
  rpcClient: {
    request: {
      collectionGetAll: mockCollectionGetAll,
      collectionCreate: mockCollectionCreate,
      collectionGetFiles: mockCollectionGetFiles,
    },
    send: {
      collectionDelete: mockCollectionDelete,
    },
  },
}));

import { useBrowserStore } from "./browserStore";
import { useCollectionStore } from "./collectionStore";

const col1: Collection = {
  id: 1,
  name: "Kicks",
  color: "#f00",
  queryJson: null,
};
const col2: Collection = {
  id: 2,
  name: "Bass",
  color: null,
  queryJson: '{"bpm":{"min":120,"max":130}}',
};

beforeEach(() => {
  vi.clearAllMocks();
  useCollectionStore.setState({ collections: [], activeCollectionId: null });
  useBrowserStore.setState({
    activeFolder: null,
    fileList: [],
    selectedIndex: -1,
    sortKey: "name",
    sortDir: "asc",
    filter: "",
  });
});

describe("collectionStore — initial state", () => {
  test("collections starts empty", () => {
    expect(useCollectionStore.getState().collections).toEqual([]);
  });

  test("activeCollectionId starts null", () => {
    expect(useCollectionStore.getState().activeCollectionId).toBeNull();
  });
});

describe("collectionStore — loadCollections", () => {
  test("calls collectionGetAll RPC", async () => {
    mockCollectionGetAll.mockResolvedValue([]);
    await useCollectionStore.getState().loadCollections();
    expect(mockCollectionGetAll).toHaveBeenCalledOnce();
  });

  test("stores returned collections", async () => {
    mockCollectionGetAll.mockResolvedValue([col1, col2]);
    await useCollectionStore.getState().loadCollections();
    expect(useCollectionStore.getState().collections).toEqual([col1, col2]);
  });
});

describe("collectionStore — selectCollection", () => {
  test("sets activeCollectionId", async () => {
    mockCollectionGetFiles.mockResolvedValue([]);
    await useCollectionStore.getState().selectCollection(1);
    expect(useCollectionStore.getState().activeCollectionId).toBe(1);
  });

  test("calls collectionGetFiles with the collection id", async () => {
    mockCollectionGetFiles.mockResolvedValue([]);
    await useCollectionStore.getState().selectCollection(42);
    expect(mockCollectionGetFiles).toHaveBeenCalledWith({ collectionId: 42 });
  });

  test("loads returned files into browserStore", async () => {
    const files: AudioFile[] = [
      {
        path: "/a/kick.wav",
        name: "kick.wav",
        extension: ".wav",
        size: 0,
        compositeId: "cid-1",
      },
    ];
    mockCollectionGetFiles.mockResolvedValue(files);
    await useCollectionStore.getState().selectCollection(1);
    expect(useBrowserStore.getState().fileList).toEqual(files);
  });

  test("clears activeFolder so returning to a folder re-triggers useFileList", async () => {
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      activeFolder: "/samples",
    });
    mockCollectionGetFiles.mockResolvedValue([]);
    await useCollectionStore.getState().selectCollection(1);
    expect(useBrowserStore.getState().activeFolder).toBeNull();
  });
});

describe("collectionStore — createCollection", () => {
  test("calls collectionCreate RPC with provided args", async () => {
    const newCol: Collection = {
      id: 3,
      name: "Test",
      color: null,
      queryJson: null,
    };
    mockCollectionCreate.mockResolvedValue(newCol);
    mockCollectionGetAll.mockResolvedValue([newCol]);
    await useCollectionStore.getState().createCollection("Test", null, null);
    expect(mockCollectionCreate).toHaveBeenCalledWith({
      name: "Test",
      color: null,
      queryJson: null,
    });
  });

  test("refreshes collections list after create", async () => {
    const newCol: Collection = {
      id: 3,
      name: "NewColl",
      color: null,
      queryJson: null,
    };
    mockCollectionCreate.mockResolvedValue(newCol);
    mockCollectionGetAll.mockResolvedValue([col1, col2, newCol]);
    await useCollectionStore.getState().createCollection("NewColl", null, null);
    expect(useCollectionStore.getState().collections).toHaveLength(3);
  });
});

describe("collectionStore — deleteCollection", () => {
  test("sends collectionDelete RPC with the collection id", async () => {
    mockCollectionGetAll.mockResolvedValue([col2]);
    await useCollectionStore.getState().deleteCollection(1);
    expect(mockCollectionDelete).toHaveBeenCalledWith({ collectionId: 1 });
  });

  test("refreshes the list after delete", async () => {
    useCollectionStore.setState({
      collections: [col1, col2],
      activeCollectionId: null,
    });
    mockCollectionGetAll.mockResolvedValue([col2]);
    await useCollectionStore.getState().deleteCollection(1);
    expect(useCollectionStore.getState().collections).toEqual([col2]);
  });

  test("clears activeCollectionId when the active collection is deleted", async () => {
    useCollectionStore.setState({ collections: [col1], activeCollectionId: 1 });
    mockCollectionGetAll.mockResolvedValue([]);
    await useCollectionStore.getState().deleteCollection(1);
    expect(useCollectionStore.getState().activeCollectionId).toBeNull();
  });

  test("clears fileList when the active collection is deleted", async () => {
    const file: AudioFile = {
      path: "/a.wav",
      name: "a.wav",
      extension: ".wav",
      size: 0,
    };
    useBrowserStore.setState({
      ...useBrowserStore.getState(),
      fileList: [file],
    });
    useCollectionStore.setState({ collections: [col1], activeCollectionId: 1 });
    mockCollectionGetAll.mockResolvedValue([]);
    await useCollectionStore.getState().deleteCollection(1);
    expect(useBrowserStore.getState().fileList).toEqual([]);
  });

  test("does not clear activeCollectionId when a different collection is deleted", async () => {
    useCollectionStore.setState({
      collections: [col1, col2],
      activeCollectionId: 2,
    });
    mockCollectionGetAll.mockResolvedValue([col2]);
    await useCollectionStore.getState().deleteCollection(1);
    expect(useCollectionStore.getState().activeCollectionId).toBe(2);
  });
});
