// Dedicated Web Worker for base64 → ArrayBuffer conversion.
// Running atob() + the byte-copy loop off the main thread prevents them from
// blocking UI events (hover effects, paint) during audio file decodes.

self.onmessage = (e: MessageEvent<{ id: number; base64: string }>) => {
  const { id, base64 } = e.data;
  try {
    const binaryStr = atob(base64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);
    // Transfer the buffer — zero-copy back to the main thread
    (self as DedicatedWorkerGlobalScope).postMessage(
      { id, buffer: bytes.buffer },
      { transfer: [bytes.buffer] },
    );
  } catch (err) {
    (self as DedicatedWorkerGlobalScope).postMessage({
      id,
      error: String(err),
    });
  }
};
