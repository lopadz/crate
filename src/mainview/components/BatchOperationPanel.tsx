import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export function BatchOperationPanel({ title, children, onClose }: Props) {
  return (
    <div
      data-testid="batch-operation-panel"
      className="flex flex-col gap-4 p-4 bg-[#1a1a1a] border border-[#333] rounded-lg"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
        <button
          type="button"
          data-testid="close-button"
          aria-label="Close"
          onClick={onClose}
          className="text-gray-400 hover:text-white text-lg leading-none"
        >
          ×
        </button>
      </div>
      {children}
    </div>
  );
}
