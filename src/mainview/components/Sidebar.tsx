export function Sidebar() {
  return (
    <div
      data-testid="sidebar"
      className="h-full flex flex-col bg-[#161616] border-r border-[#2a2a2a] text-sm text-gray-400 select-none"
    >
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
        Folders
      </div>
      {/* FolderTree mounts here in Commit 7 */}
    </div>
  );
}
