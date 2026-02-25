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
  private pauseOffset = 0;
  private startedAt = 0;

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private async decodeFile(file: AudioFile): Promise<AudioBuffer> {
    const cached = this.cache.get(file.path);
    if (cached) return cached;

    const ctx = this.getCtx();
    const base64 = await rpcClient?.request.fsReadAudio({ path: file.path });
    if (!base64) throw new Error(`Failed to read audio: ${file.path}`);

    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    // Create a blob URL so other consumers (e.g. WaveSurfer) can load without CORS issues
    if (!this.blobUrlCache.has(file.path)) {
      const blob = new Blob([bytes]);
      this.blobUrlCache.set(file.path, URL.createObjectURL(blob));
    }

    const buffer = await ctx.decodeAudioData(bytes.buffer);

    // Pre-compute and cache the RMS dB so play() never blocks the main thread.
    this.measuredDbCache.set(file.path, computeMeasuredDb(buffer));

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
    this.stop();

    const ctx = this.getCtx();
    const buffer = await this.decodeFile(file);

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const { normalizeVolume, normalizationTargetLufs } =
      useSettingsStore.getState();
    if (normalizeVolume) {
      const gainNode = ctx.createGain();
      // measuredDb was cached during decodeFile — no main-thread blocking here.
      const measuredDb =
        this.measuredDbCache.get(file.path) ?? computeMeasuredDb(buffer);
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
    for (const url of this.blobUrlCache.values()) {
      URL.revokeObjectURL(url);
    }
    this.blobUrlCache.clear();
  }
}

export const audioEngine = new AudioEngine();
