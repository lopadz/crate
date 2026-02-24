import { create } from "zustand";
import type { Collection } from "../../shared/types";
import { rpcClient } from "../rpc";
import { useBrowserStore } from "./browserStore";

interface CollectionState {
  collections: Collection[];
  activeCollectionId: number | null;
  loadCollections: () => Promise<void>;
  selectCollection: (id: number) => Promise<void>;
  createCollection: (
    name: string,
    color: string | null,
    queryJson: string | null,
  ) => Promise<void>;
  deleteCollection: (id: number) => Promise<void>;
}

export const useCollectionStore = create<CollectionState>((set) => ({
  collections: [],
  activeCollectionId: null,

  async loadCollections() {
    const collections = await rpcClient?.request.collectionGetAll({});
    if (collections) set({ collections });
  },

  async selectCollection(id) {
    set({ activeCollectionId: id });
    useBrowserStore.getState().setActiveFolder(null);
    const files = await rpcClient?.request.collectionGetFiles({
      collectionId: id,
    });
    if (files) useBrowserStore.getState().setFileList(files);
  },

  async createCollection(name, color, queryJson) {
    await rpcClient?.request.collectionCreate({ name, color, queryJson });
    const collections = await rpcClient?.request.collectionGetAll({});
    if (collections) set({ collections });
  },

  async deleteCollection(id) {
    rpcClient?.send.collectionDelete({ collectionId: id });
    const { activeCollectionId } = useCollectionStore.getState();
    if (activeCollectionId === id) {
      set({ activeCollectionId: null });
      useBrowserStore.getState().setFileList([]);
    }
    const collections = await rpcClient?.request.collectionGetAll({});
    if (collections) set({ collections });
  },
}));
