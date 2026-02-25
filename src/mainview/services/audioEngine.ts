import type { AudioFile } from "../../shared/types";
import { rpcClient } from "../rpc";
import { usePlaybackStore } from "../stores/playbackStore";
import { useSettingsStore } from "../stores/settingsStore";

const CACHE_MAX = 5;

// Returns the RMS-based measured dB of a buffer (the expensive per-sample loop).
// Separated from the final gain formula so the result can be cached per file.
function computeMeasuredDb(buffer: AudioBuffer): number {
  let sumSquares = 0;
  let totalSamples = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      sumSquares += data[i] * data[i];
    }
    totalSamples += data.length;
  }
  const rms = Math.sqrt(sumSquares / totalSamples);
  if (rms === 0) return -Infinity;
  return 20 * Math.log10(rms);
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private cache = new Map<string, AudioBuffer>();
  private blobUrlCache = new Map<string, string>();
  // Caches the expensive per-sample RMS computation. Invalidated on cache eviction.
  private measuredDbCache = new Map<string, number>();
  // Tracks in-flight decodes so concurrent preload() + play() calls for the same
  // uncached file share one IPC round-trip instead of issuing duplicate requests.
  private pending = new Map<string, Promise<AudioBuffer>>();
  // Incremented on every play() call. After each await, a stale call bails out
  // instead of starting a second audio source concurrently with the current one.
  private playId = 0;
  private pauseOffset = 0;
  private startedAt = 0;

  // Web Worker for base64 → ArrayBuffer conversion. Created lazily on first use
  // so test environments (no Worker global) are unaffected.
  private decodeWorker: Worker | null = null;
  private workerPending = new Map<
    number,
    { resolve: (buf: ArrayBuffer) => void; reject: (err: Error) => void }
  >();
  private nextDecodeId = 0;

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private getDecodeWorker(): Worker | null {
    if (this.decodeWorker) return this.decodeWorker;
    if (typeof Worker === "undefined") return null;
    this.decodeWorker = new Worker(
      new URL("./decodeWorker.ts", import.meta.url),
      { type: "module" },
    );
    this.decodeWorker.onmessage = (
      e: MessageEvent<{ id: number; buffer?: ArrayBuffer; error?: string }>,
    ) => {
      const { id, buffer, error } = e.data;
      const pending = this.workerPending.get(id);
      if (!pending) return;
      this.workerPending.delete(id);
      if (error || !buffer) {
        pending.reject(new Error(error ?? "Worker decode failed"));
      } else {
        pending.resolve(buffer);
      }
    };
    return this.decodeWorker;
  }

  // Decode base64 → ArrayBuffer in the worker thread (zero main-thread blocking
  // beyond the postMessage string copy, which is a fast memcpy ~1–5ms).
  // Falls back to synchronous decode in environments without Worker support.
  private decodeBase64(base64: string): Promise<ArrayBuffer> {
    const worker = this.getDecodeWorker();
    if (!worker) {
      // Sync fallback (test environments / no Worker support)
      const binaryStr = atob(base64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);
      return Promise.resolve(bytes.buffer);
    }
    return new Promise((resolve, reject) => {
      const id = ++this.nextDecodeId;
      this.workerPending.set(id, { resolve, reject });
      worker.postMessage({ id, base64 });
    });
  }

  private decodeFile(file: AudioFile): Promise<AudioBuffer> {
    const cached = this.cache.get(file.path);
    if (cached) return Promise.resolve(cached);

    const inFlight = this.pending.get(file.path);
    if (inFlight) return inFlight;

    const promise = this._doDecode(file);
    this.pending.set(file.path, promise);
    void promise.finally(() => this.pending.delete(file.path));
    return promise;
  }

  private async _doDecode(file: AudioFile): Promise<AudioBuffer> {
    const ctx = this.getCtx();
    const base64 = await rpcClient?.request.fsReadAudio({ path: file.path });
    if (!base64) throw new Error(`Failed to read audio: ${file.path}`);

    // Decode base64 → ArrayBuffer in the worker — atob + byte-copy loop run
    // entirely off the main thread, keeping hover effects and paint responsive.
    const arrayBuffer = await this.decodeBase64(base64);

    // Create blob URL before decodeAudioData in case the impl transfers the buffer
    if (!this.blobUrlCache.has(file.path)) {
      const blob = new Blob([arrayBuffer]);
      this.blobUrlCache.set(file.path, URL.createObjectURL(blob));
    }

    const buffer = await ctx.decodeAudioData(arrayBuffer);

    // Evict oldest entry if cache is full
    if (this.cache.size >= CACHE_MAX) {
      const oldest = this.cache.keys().next().value as string;
      const evictedUrl = this.blobUrlCache.get(oldest);
      if (evictedUrl) {
        URL.revokeObjectURL(evictedUrl);
        this.blobUrlCache.delete(oldest);
      }
      this.measuredDbCache.delete(oldest);
      this.cache.delete(oldest);
    }
    this.cache.set(file.path, buffer);

    // Defer RMS computation so preloads and neighbor decodes don't block the main thread.
    // play() will compute synchronously via the ?? fallback if this hasn't fired yet.
    setTimeout(() => {
      if (!this.measuredDbCache.has(file.path)) {
        this.measuredDbCache.set(file.path, computeMeasuredDb(buffer));
      }
    }, 0);

    return buffer;
  }

  /** Returns a blob URL for the file if it has been loaded, undefined otherwise. */
  getBlobUrl(path: string): string | undefined {
    return this.blobUrlCache.get(path);
  }

  /** Decode the file to warm the cache. Returns a Promise that resolves when ready. */
  preload(file: AudioFile): Promise<void> {
    return this.decodeFile(file).then(() => {});
  }

  async play(file: AudioFile, neighbors: AudioFile[] = []): Promise<void> {
    const id = ++this.playId;
    this.stop();

    const ctx = this.getCtx();
    const buffer = await this.decodeFile(file);

    // A newer play() call was made while we were decoding — bail out to avoid
    // starting two audio sources concurrently (the "two files playing" bug).
    if (id !== this.playId) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const { normalizeVolume, normalizationTargetLufs } =
      useSettingsStore.getState();
    if (normalizeVolume) {
      const gainNode = ctx.createGain();
      // Use cached RMS if the deferred setTimeout already fired; otherwise
      // compute once synchronously and cache so subsequent plays are instant.
      const measuredDb =
        this.measuredDbCache.get(file.path) ?? computeMeasuredDb(buffer);
      this.measuredDbCache.set(file.path, measuredDb);
      gainNode.gain.value = Math.pow(
        10,
        (normalizationTargetLufs - measuredDb) / 20,
      );
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
    } else {
      source.connect(ctx.destination);
    }

    source.loop = usePlaybackStore.getState().loop;
    if (ctx.state === "suspended") await ctx.resume();
    source.start(0, this.pauseOffset);
    this.startedAt = ctx.currentTime - this.pauseOffset;
    this.pauseOffset = 0;
    this.source = source;

    source.onended = () => {
      usePlaybackStore.getState().setIsPlaying(false);
    };

    usePlaybackStore.getState().setCurrentFile(file);
    usePlaybackStore.getState().setIsPlaying(true);

    // Preload neighbors in the background (fire-and-forget)
    for (const neighbor of neighbors) {
      this.decodeFile(neighbor).catch(() => {});
    }
  }

  stop(): void {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        // Ignore if already stopped
      }
      this.source.disconnect();
      this.source = null;
    }
    this.pauseOffset = 0;
    usePlaybackStore.getState().setIsPlaying(false);
  }

  pause(): void {
    if (!this.source) return;
    const ctx = this.getCtx();
    const elapsed = ctx.currentTime - this.startedAt;
    this.pauseOffset = elapsed;
    try {
      this.source.stop();
    } catch {
      // Ignore if already stopped
    }
    this.source.disconnect();
    this.source = null;
    usePlaybackStore.getState().setIsPlaying(false);
  }

  setLoop(enabled: boolean): void {
    if (this.source) {
      this.source.loop = enabled;
    }
  }

  seek(position: number): void {
    const { isPlaying, currentFile } = usePlaybackStore.getState();
    this.stop();
    this.pauseOffset = position;
    if (isPlaying && currentFile) {
      this.play(currentFile);
    }
  }

  dispose(): void {
    this.stop();
    this.ctx?.close();
    this.ctx = null;
    this.cache.clear();
    this.measuredDbCache.clear();
    this.pending.clear();
    this.decodeWorker?.terminate();
    this.decodeWorker = null;
    this.workerPending.clear();
    for (const url of this.blobUrlCache.values()) {
      URL.revokeObjectURL(url);
    }
    this.blobUrlCache.clear();
  }
}

export const audioEngine = new AudioEngine();
