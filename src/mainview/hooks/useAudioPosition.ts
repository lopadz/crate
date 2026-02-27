import { useEffect, useState } from "react";
import { audioEngine } from "../services/audioEngine";
import { usePlaybackStore } from "../stores/playbackStore";

/**
 * Returns the current audio playback position in seconds.
 * Runs a RAF loop while playing and snaps to audioEngine.getPosition()
 * when playback stops or pauses (so stop → 0, pause → paused offset).
 */
export function useAudioPosition(): number {
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const [position, setPosition] = useState(() => audioEngine.getPosition());

  useEffect(() => {
    setPosition(audioEngine.getPosition());
    if (!isPlaying) return;

    let rafId: number;
    const tick = () => {
      setPosition(audioEngine.getPosition());
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  return position;
}
