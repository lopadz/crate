import { PauseIcon, PlayIcon, RepeatIcon, StopIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { useAudioPosition } from "../hooks/useAudioPosition";
import { audioEngine } from "../services/audioEngine";
import { useBrowserStore } from "../stores/browserStore";
import { usePlaybackStore } from "../stores/playbackStore";

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function PlaybackBar() {
  const { currentFile, isPlaying, loop, volume, duration, toggleLoop, setVolume } =
    usePlaybackStore();
  const position = useAudioPosition();
  // scrubValue is non-null while the user is dragging the range input.
  // During a drag we show the drag position without seeking so the audio
  // engine doesn't restart on every pixel of movement.
  const scrubValueRef = useRef<number | null>(null);
  const [scrubValue, setScrubValue] = useState<number | null>(null);

  const handlePlayPause = () => {
    if (isPlaying) {
      audioEngine.pause();
    } else {
      const { fileList, selectedIndex } = useBrowserStore.getState();
      const file = fileList[selectedIndex] ?? currentFile;
      if (file) void audioEngine.play(file);
    }
  };

  const handleScrubPointerDown = () => {
    scrubValueRef.current = position;
    setScrubValue(position);
  };

  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (scrubValueRef.current !== null) {
      scrubValueRef.current = val;
      setScrubValue(val);
    } else {
      // Keyboard navigation (no pointer): seek immediately
      audioEngine.seek(val);
    }
  };

  const handleScrubRelease = (e: React.PointerEvent<HTMLInputElement>) => {
    if (scrubValueRef.current !== null) {
      audioEngine.seek(Number((e.target as HTMLInputElement).value));
      scrubValueRef.current = null;
      setScrubValue(null);
    }
  };

  return (
    <div
      data-testid="playback-bar"
      className="flex flex-col shrink-0 bg-[#111111] border-t border-[#2a2a2a] text-gray-400"
    >
      {/* Controls row */}
      <div className="h-10 flex items-center gap-3 px-4">
        {/* Transport */}
        <button
          data-testid="transport-play-pause"
          type="button"
          aria-label={isPlaying ? "Pause" : "Play"}
          className="text-gray-300 hover:text-white px-1 py-1"
          onClick={handlePlayPause}
        >
          {isPlaying ? <PauseIcon size={16} weight="fill" /> : <PlayIcon size={16} weight="fill" />}
        </button>

        <button
          data-testid="transport-stop"
          type="button"
          aria-label="Stop"
          className="text-gray-300 hover:text-white px-1 py-1"
          onClick={() => audioEngine.stop()}
        >
          <StopIcon size={16} weight="fill" />
        </button>

        {/* Loop */}
        <button
          data-testid="loop-btn"
          type="button"
          aria-label="Loop"
          aria-pressed={loop}
          className={`px-1 py-1 ${loop ? "text-indigo-400" : "text-gray-500 hover:text-gray-300"}`}
          onClick={toggleLoop}
        >
          <RepeatIcon size={16} weight={loop ? "fill" : "regular"} />
        </button>

        {/* Timeline scrubber */}
        <input
          data-testid="timeline-scrubber"
          type="range"
          min={0}
          max={duration}
          step={0.1}
          value={scrubValue ?? position}
          onPointerDown={handleScrubPointerDown}
          onChange={handleScrubChange}
          onPointerUp={handleScrubRelease}
          className="flex-1 accent-indigo-500 h-1"
          aria-label="Timeline"
        />

        {/* Volume */}
        <input
          data-testid="volume-slider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => {
            const vol = Number(e.target.value);
            setVolume(vol);
            audioEngine.setVolume(vol);
          }}
          className="w-20 accent-indigo-500"
          aria-label="Volume"
        />
      </div>

      {/* Timestamps row */}
      <div className="flex items-center px-4 pb-1 text-[10px] tabular-nums text-gray-600 gap-1">
        <span>0:00:00</span>
        <span className="flex-1 text-center">
          {currentFile && (
            <span data-testid="current-file-name" className="truncate text-gray-400">
              {currentFile.name}
            </span>
          )}
        </span>
        <div className="flex gap-2">
          <span data-testid="timestamp-current">{formatTime(position)}</span>
          <span>/</span>
          <span data-testid="timestamp-duration">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
