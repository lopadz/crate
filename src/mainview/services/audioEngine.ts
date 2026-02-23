import { Input, UrlSource, AudioBufferSink, ALL_FORMATS } from "mediabunny";
import type { AudioFile } from "../../shared/types";
import { usePlaybackStore } from "../stores/playbackStore";

const CACHE_MAX = 5;

function mergeChunks(ctx: AudioContext, chunks: AudioBuffer[]): AudioBuffer {
  if (chunks.length === 0) return ctx.createBuffer(1, 1, 44100);
  if (chunks.length === 1) return chunks[0];

  const { numberOfChannels, sampleRate } = chunks[0];
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = ctx.createBuffer(numberOfChannels, totalLength, sampleRate);

  let offset = 0;
  for (const chunk of chunks) {
    for (let ch = 0; ch < numberOfChannels; ch++) {
      merged.getChannelData(ch).set(chunk.getChannelData(ch), offset);
    }
    offset += chunk.length;
  }
  return merged;
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
    const input = new Input({
      source: new UrlSource(`file://${file.path}`),
      formats: ALL_FORMATS,
    });

    const audioTrack = await input.getPrimaryAudioTrack();
    if (!audioTrack) throw new Error(`No audio track: ${file.path}`);

    const sink = new AudioBufferSink(audioTrack);
    const chunks: AudioBuffer[] = [];
    for await (const wrapped of sink.buffers()) {
      chunks.push(wrapped.buffer);
    }
    input.dispose();

    const buffer = mergeChunks(ctx, chunks);

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
    source.connect(ctx.destination);
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
