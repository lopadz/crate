import { BrowserWindow, Updater, Utils } from "electrobun/bun";
import type { AnalysisResult } from "./analysisQueue";
import { queries } from "./db";
import { scanFolderRecursive } from "./filesystem";
import { createRpc } from "./rpc";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log("Vite dev server not running. Run 'bun run dev:hmr' for HMR support.");
    }
  }
  return "views://mainview/index.html";
}

// Notifier<T>: wraps a late-bound callback so RPC handlers can push
// notifications to the renderer without a circular dependency on mainWindow.
class Notifier<T> {
  private fn: (payload: T) => void = () => {};
  bind(fn: (payload: T) => void): void {
    this.fn = fn;
  }
  notify(payload: T): void {
    this.fn(payload);
  }
}

const directoryChangedNotifier = new Notifier<{ path: string }>();
const analysisResultNotifier = new Notifier<AnalysisResult>();

const rpc = createRpc(
  (path) => directoryChangedNotifier.notify({ path }),
  (result) => analysisResultNotifier.notify(result),
);

const url = await getMainViewUrl();

const mainWindow = new BrowserWindow({
  title: "Crate",
  url,
  rpc,
  frame: {
    width: 1200,
    height: 800,
    x: 100,
    y: 100,
  },
});

directoryChangedNotifier.bind((p) => mainWindow.webview.rpc?.send.fsDirectoryChanged(p));
analysisResultNotifier.bind((r) => mainWindow.webview.rpc?.send.analysisResult(r));

mainWindow.on("close", () => {
  Utils.quit();
});

// Re-index all pinned folders on startup to catch filesystem changes that
// occurred while the app was closed. Fire-and-forget; no progress push needed
// since the renderer hasn't loaded the folder list yet.
for (const folderPath of queries.getPinnedFolders()) {
  void scanFolderRecursive(folderPath, (files) => queries.upsertFilesFromScan(files));
}

console.log("Crate started.");
