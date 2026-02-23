import { BrowserWindow, Updater, Utils } from "electrobun/bun";
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
      console.log(
        "Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
      );
    }
  }
  return "views://mainview/index.html";
}

// Late-bound callback: populated after mainWindow is created so the RPC
// handler can push directory-change notifications to the renderer.
let notifyDirectoryChanged: (path: string) => void = () => {};

const rpc = createRpc((path) => notifyDirectoryChanged(path));

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

notifyDirectoryChanged = (path) =>
  mainWindow.webview.rpc?.send.fsDirectoryChanged({ path });

mainWindow.on("close", () => {
  Utils.quit();
});

// Re-index all pinned folders on startup to catch filesystem changes that
// occurred while the app was closed. Fire-and-forget; no progress push needed
// since the renderer hasn't loaded the folder list yet.
for (const folderPath of queries.getPinnedFolders()) {
  void scanFolderRecursive(folderPath, (files) =>
    queries.upsertFilesFromScan(files),
  );
}

console.log("Crate started.");
