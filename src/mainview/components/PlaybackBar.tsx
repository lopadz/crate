import { audioEngine } from "../services/audioEngine";
import { useBrowserStore } from "../stores/browserStore";
import { usePlaybackStore } from "../stores/playbackStore";

export function PlaybackBar() {
  const { currentFile, isPlaying, loop, volume, toggleLoop, setVolume } = usePlaybackStore();

  const handlePlayPause = () => {
    if (isPlaying) {
      audioEngine.pause();
    } else {
      const { fileList, selectedIndex } = useBrowserStore.getState();
      const file = fileList[selectedIndex] ?? currentFile;
      if (file) void audioEngine.play(file);
    }
  };

  return (
    <div
      data-testid="playback-bar"
      className="h-14 flex items-center gap-4 px-4 bg-[#111111] border-t border-[#2a2a2a] text-gray-400 shrink-0"
    >
      {/* Transport */}
      <button
        data-testid="transport-play-pause"
        type="button"
        aria-label={isPlaying ? "Pause" : "Play"}
        className="text-gray-300 hover:text-white text-sm px-2 py-1"
        onClick={handlePlayPause}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      <button
        data-testid="transport-stop"
        type="button"
        aria-label="Stop"
        className="text-gray-300 hover:text-white text-sm px-2 py-1"
        onClick={() => audioEngine.stop()}
      >
        ⏹
      </button>

      {/* Loop */}
      <button
        data-testid="loop-btn"
        type="button"
        aria-label="Loop"
        aria-pressed={loop}
        className={`text-sm px-2 py-1 ${loop ? "text-indigo-400" : "text-gray-500 hover:text-gray-300"}`}
        onClick={toggleLoop}
      >
        ↻
      </button>

      {/* Current file */}
      {currentFile && (
        <span data-testid="current-file-name" className="flex-1 text-xs truncate text-gray-400">
          {currentFile.name}
        </span>
      )}

      {/* Volume */}
      <input
        data-testid="volume-slider"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        className="w-20 accent-indigo-500"
        aria-label="Volume"
      />
    </div>
  );
}
