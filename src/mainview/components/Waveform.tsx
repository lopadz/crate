import { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import { audioEngine } from "../services/audioEngine";
import { usePlaybackStore } from "../stores/playbackStore";

export function Waveform() {
  const currentFile = usePlaybackStore((s) => s.currentFile);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);

  // Create WaveSurfer instance once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#4a4a4a",
      progressColor: "#6366f1",
      height: "auto",
      interact: true,
    });

    ws.on("interaction", (currentTime: number) => {
      audioEngine.seek(currentTime);
    });

    wsRef.current = ws;

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
  }, []);

  // Load new file whenever currentFile changes.
  // audioEngine always decodes before setting currentFile, so the blob URL is ready.
  // After load resolves, reset the cursor to the start so it doesn't carry over
  // the fractional position from the previous file.
  useEffect(() => {
    if (!currentFile || !wsRef.current) return;
    const blobUrl = audioEngine.getBlobUrl(currentFile.path);
    if (blobUrl) wsRef.current.load(blobUrl).then(() => wsRef.current?.seekTo(0));
  }, [currentFile]);

  // Sync WaveSurfer cursor with actual audio position on every animation frame.
  // The modulo handles loop wrap-around: elapsed time exceeds duration when
  // AudioBufferSourceNode loops, so we fold it back into [0, duration).
  useEffect(() => {
    if (!isPlaying) return;
    let rafId: number;
    const tick = () => {
      if (wsRef.current) {
        const pos = audioEngine.getPosition();
        const duration = wsRef.current.getDuration();
        if (duration > 0) wsRef.current.seekTo((pos % duration) / duration);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  return <div data-testid="waveform" ref={containerRef} className="w-full h-24 bg-[#111]" />;
}
