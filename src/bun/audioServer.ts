// Local HTTP server that serves audio files directly from disk.
// The WebView fetches from this instead of going through IPC, eliminating
// the base64 encode/decode overhead for large files.
//
// A random token is generated at startup and required on every request,
// so other local processes cannot access arbitrary files.

const token = crypto.randomUUID().replace(/-/g, "");

const server = Bun.serve({
  port: 0, // OS picks a random available port
  fetch(req) {
    const url = new URL(req.url);

    if (url.searchParams.get("token") !== token) {
      return new Response("Forbidden", { status: 403 });
    }

    const filePath = url.searchParams.get("path");
    if (!filePath) return new Response("Bad Request", { status: 400 });

    // Bun.file() streams from disk and auto-handles Range requests,
    // Content-Type, Content-Length — ideal for audio seeking.
    return new Response(Bun.file(filePath), {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  },
});

export const audioServerToken = token;
export const audioServerBaseUrl = `http://localhost:${server.port}`;

export function getAudioUrl(filePath: string): string {
  return `${audioServerBaseUrl}/audio?path=${encodeURIComponent(filePath)}&token=${token}`;
}

export function stopAudioServer(): void {
  server.stop();
}
