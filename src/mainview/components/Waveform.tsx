import { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import { audioEngine } from "../services/audioEngine";
import { usePlaybackStore } from "../stores/playbackStore";

export function Waveform() {
  const currentFile = usePlaybackStore((s) => s.currentFile);
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

    ws.on("seeking", (currentTime: number) => {
      audioEngine.seek(currentTime);
    });

    wsRef.current = ws;

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
  }, []);

  // Load new file whenever currentFile changes
  useEffect(() => {
    if (!currentFile || !wsRef.current) return;
    wsRef.current.load(`file://${currentFile.path}`);
  }, [currentFile]);

  return (
    <div
      data-testid="waveform"
      ref={containerRef}
      className="w-full h-24 bg-[#111]"
    />
  );
}
