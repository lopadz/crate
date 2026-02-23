import { Group, Panel, Separator } from "react-resizable-panels";
import { DetailPanel } from "./components/DetailPanel";
import { FileList } from "./components/FileList";
import { PlaybackBar } from "./components/PlaybackBar";
import { Sidebar } from "./components/Sidebar";
import { useFileList } from "./hooks/useFileList";
import { useKeyboardNav } from "./hooks/useKeyboardNav";

function App() {
  useFileList();
  useKeyboardNav();

  return (
    <div className="flex flex-col h-screen bg-[#1a1a1a] text-gray-100 overflow-hidden">
      <Group
        orientation="horizontal"
        className="flex-1 overflow-hidden"
      >
        <Panel defaultSize={18} minSize={12} maxSize={30}>
          <Sidebar />
        </Panel>

        <Separator className="w-px bg-[#2a2a2a] hover:bg-indigo-500 transition-colors cursor-col-resize" />

        <Panel defaultSize={57}>
          <div
            data-testid="file-list-panel"
            className="h-full bg-[#1a1a1a]"
          >
            <FileList />
          </div>
        </Panel>

        <Separator className="w-px bg-[#2a2a2a] hover:bg-indigo-500 transition-colors cursor-col-resize" />

        <Panel defaultSize={25} minSize={15} maxSize={40}>
          <DetailPanel />
        </Panel>
      </Group>

      <PlaybackBar />
    </div>
  );
}

export default App;
