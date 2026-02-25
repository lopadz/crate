import { create } from "zustand";

export type OperationRecord = {
  id: number;
  operation: string;
  files: Array<{ originalPath: string; newPath: string }>;
  timestamp: number;
  rolledBackAt: number | null;
};

type OperationsState = {
  log: OperationRecord[];
  isUndoing: boolean;
  pendingBatchOp: "rename" | "move" | "convert" | null;
  setLog: (entries: OperationRecord[]) => void;
  prependEntry: (entry: OperationRecord) => void;
  setUndoing: (v: boolean) => void;
  setPendingBatchOp: (op: OperationsState["pendingBatchOp"]) => void;
};

export const useOperationsStore = create<OperationsState>((set) => ({
  log: [],
  isUndoing: false,
  pendingBatchOp: null,

  setLog: (entries) => set({ log: entries }),

  prependEntry: (entry) => set((state) => ({ log: [entry, ...state.log] })),

  setUndoing: (v) => set({ isUndoing: v }),

  setPendingBatchOp: (op) => set({ pendingBatchOp: op }),
}));
