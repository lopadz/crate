import type { AudioFile } from "../../shared/types";
import { rpcClient } from "../rpc";
import { usePlaybackStore } from "../stores/playbackStore";
import { useSettingsStore } from "../stores/settingsStore";

const CACHE_MAX = 5;

function computeGain(buffer: AudioBuffer, targetLufsDb: number): number {
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
  if (rms === 0) return 1.0;
  const measuredDb = 20 * Math.log10(rms);
  const gainDb = targetLufsDb - measuredDb;
  return Math.pow(10, gainDb / 20);
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private cache = new Map<string, AudioBuffer>();
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
    const buffer = await ctx.decodeAudioData(bytes.buffer);

    // Evict oldest entry if cache is full
    if (this.cache.size >= CACHE_MAX) {
      const oldest = this.cache.keys().next().value as string;
      this.cache.delete(oldest);
    }
    this.cache.set(file.path, buffer);

    return buffer;
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
      gainNode.gain.value = computeGain(buffer, normalizationTargetLufs);
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
  }
}

export const audioEngine = new AudioEngine();
