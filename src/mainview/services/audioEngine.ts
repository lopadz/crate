import type { AudioFile } from "../../shared/types";
import { audioApi } from "../api/audio";
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
  private masterGain: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private cache = new Map<string, AudioBuffer>();
  // Caches the expensive per-sample RMS computation. Invalidated on cache eviction.
  private measuredDbCache = new Map<string, number>();
  // Tracks in-flight decodes so concurrent preload() + play() calls for the same
  // uncached file share one fetch instead of issuing duplicate requests.
  private pending = new Map<string, Promise<AudioBuffer>>();
  // Incremented on every play() call. After each await, a stale call bails out
  // instead of starting a second audio source concurrently with the current one.
  private playId = 0;
  private pauseOffset = 0;
  private startedAt = 0;
  // Tracks whether the user intends audio to be playing. Updated synchronously
  // before any awaits so rapid seek() calls see the correct state even while
  // a previous play() is still mid-decode (store's isPlaying would be false).
  private _intentPlaying = false;

  // HTTP audio server config — set once at startup via setServerConfig().
  // Until set, _doDecode falls back to the legacy IPC base64 path.
  private serverBaseUrl: string | null = null;
  private serverToken: string | null = null;

  /** Called once at app startup with the local HTTP audio server coordinates. */
  setServerConfig(baseUrl: string, token: string): void {
    this.serverBaseUrl = baseUrl;
    this.serverToken = token;
  }

  /**
   * Returns an http:// URL for the given file path once the server is
   * configured, undefined otherwise. WaveSurfer can use this URL directly.
   */
  getAudioUrl(path: string): string | undefined {
    if (!this.serverBaseUrl || !this.serverToken) return undefined;
    return `${this.serverBaseUrl}/audio?path=${encodeURIComponent(path)}&token=${this.serverToken}`;
  }

  /** @deprecated Use getAudioUrl(). Kept for Waveform.tsx compatibility. */
  getBlobUrl(path: string): string | undefined {
    return this.getAudioUrl(path);
  }

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private getMasterGain(): GainNode {
    const ctx = this.getCtx();
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = usePlaybackStore.getState().volume;
      this.masterGain.connect(ctx.destination);
    }
    return this.masterGain;
  }

  /** Set the master output volume (0–1). Takes effect immediately. */
  setVolume(vol: number): void {
    this.getMasterGain().gain.value = vol;
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
    let arrayBuffer: ArrayBuffer;

    const httpUrl = this.getAudioUrl(file.path);
    if (httpUrl) {
      // Fast path: WebView fetches directly from the local HTTP server.
      // No IPC binary transfer, no base64 encode/decode — just a local HTTP GET.
      const response = await fetch(httpUrl);
      if (!response.ok) throw new Error(`Audio fetch failed (${response.status}): ${file.path}`);
      arrayBuffer = await response.arrayBuffer();
    } else {
      // Legacy fallback: used only in the brief window before setServerConfig()
      // is called (or in test environments without the Bun HTTP server).
      const base64 = await audioApi.readBase64(file.path);
      if (!base64) throw new Error(`Failed to read audio: ${file.path}`);
      const binaryStr = atob(base64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);
      arrayBuffer = bytes.buffer;
    }

    const buffer = await ctx.decodeAudioData(arrayBuffer);

    // Evict oldest entry if cache is full
    if (this.cache.size >= CACHE_MAX) {
      const oldest = this.cache.keys().next().value as string;
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

  /** Decode the file to warm the cache. Returns a Promise that resolves when ready. */
  preload(file: AudioFile): Promise<void> {
    return this.decodeFile(file).then(() => {});
  }

  async play(file: AudioFile, neighbors: AudioFile[] = []): Promise<void> {
    const id = ++this.playId;
    const { currentFile } = usePlaybackStore.getState();
    const offset = currentFile?.path === file.path ? this.pauseOffset : 0;
    this.stop();
    // Set intent AFTER stop() so stop()'s own clear doesn't win.
    // Must be synchronous (before any await) so rapid seek() calls see it.
    this._intentPlaying = true;

    const ctx = this.getCtx();
    const buffer = await this.decodeFile(file);

    // A newer play() call was made while we were decoding — bail out to avoid
    // starting two audio sources concurrently (the "two files playing" bug).
    if (id !== this.playId) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const masterGain = this.getMasterGain();
    const { normalizeVolume, normalizationTargetLufs } = useSettingsStore.getState();
    if (normalizeVolume) {
      const gainNode = ctx.createGain();
      // Use cached RMS if the deferred setTimeout already fired; otherwise
      // compute once synchronously and cache so subsequent plays are instant.
      const measuredDb = this.measuredDbCache.get(file.path) ?? computeMeasuredDb(buffer);
      this.measuredDbCache.set(file.path, measuredDb);
      gainNode.gain.value = 10 ** ((normalizationTargetLufs - measuredDb) / 20);
      source.connect(gainNode);
      gainNode.connect(masterGain);
    } else {
      source.connect(masterGain);
    }

    source.loop = usePlaybackStore.getState().loop;
    if (ctx.state === "suspended") await ctx.resume();
    source.start(0, offset);
    this.startedAt = ctx.currentTime - offset;
    this.pauseOffset = 0;
    this.source = source;

    source.onended = () => {
      usePlaybackStore.getState().setIsPlaying(false);
    };

    usePlaybackStore.getState().setCurrentFile(file);
    usePlaybackStore.getState().setDuration(buffer.duration);
    usePlaybackStore.getState().setIsPlaying(true);

    // Preload neighbors in the background (fire-and-forget)
    for (const neighbor of neighbors) {
      this.decodeFile(neighbor).catch(() => {});
    }
  }

  stop(): void {
    this._intentPlaying = false;
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
    this._intentPlaying = false;
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

  /** Returns the current playback position in seconds. */
  getPosition(): number {
    if (!this.source || !this.ctx) return this.pauseOffset;
    return this.ctx.currentTime - this.startedAt;
  }

  seek(position: number): void {
    // Read _intentPlaying before stop() clears it — the store's isPlaying is
    // unreliable here because a previous seek() may have already set it to false
    // via stop() while a new play() is still mid-decode.
    const wasPlaying = this._intentPlaying;
    const { currentFile } = usePlaybackStore.getState();
    this.stop();
    this.pauseOffset = position;
    if (wasPlaying && currentFile) {
      void this.play(currentFile);
    }
  }

  dispose(): void {
    this.stop();
    this.masterGain?.disconnect();
    this.masterGain = null;
    this.ctx?.close();
    this.ctx = null;
    this.cache.clear();
    this.measuredDbCache.clear();
    this.pending.clear();
  }
}

export const audioEngine = new AudioEngine();
