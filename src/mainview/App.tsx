import { Group, Panel, Separator } from "react-resizable-panels";
import { DetailPanel } from "./components/DetailPanel";
import { FileList } from "./components/FileList";
import { PlaybackBar } from "./components/PlaybackBar";
import { Sidebar } from "./components/Sidebar";
import { useAnalysis } from "./hooks/useAnalysis";
import { useDragCopyPrewarm } from "./hooks/useDragCopyPrewarm";
import { useFileList } from "./hooks/useFileList";
import { useFilePreload } from "./hooks/useFilePreload";
import { useKeyboardNav } from "./hooks/useKeyboardNav";

function App() {
  useAnalysis();
  useFileList();
  useFilePreload();
  useDragCopyPrewarm();
  useKeyboardNav();

  return (
    <div className="flex flex-col h-screen bg-[#1a1a1a] text-gray-100 overflow-hidden">
      <Group orientation="horizontal" className="flex-1 overflow-hidden">
        <Panel minSize={150} maxSize={300}>
          <Sidebar />
        </Panel>

        <Separator className="w-px bg-[#2a2a2a] hover:bg-indigo-500 transition-colors cursor-col-resize" />

        <Panel minSize={150} maxSize={600}>
          <div data-testid="file-list-panel" className="h-full bg-[#1a1a1a]">
            <FileList />
          </div>
        </Panel>

        <Separator className="w-px bg-[#2a2a2a] hover:bg-indigo-500 transition-colors cursor-col-resize" />

        <Panel minSize={150} maxSize={300}>
          <DetailPanel />
        </Panel>
      </Group>

      <PlaybackBar />
    </div>
  );
}

export default App;
