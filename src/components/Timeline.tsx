import { useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Repeat,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { ClipItem } from "../types";
import { formatTimecode } from "../utils/videoEngine";

interface TimelineProps {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  loopClip: boolean;
  playbackRate: number;
  isMuted: boolean;
  hasRealAudio: boolean;
  waveform: number[];
  clips: ClipItem[];
  activeClip: ClipItem | null;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onChangeSpeed: (rate: number) => void;
  onToggleMute: () => void;
  onSelectClip: (id: string) => void;
  onTrimActiveClip: (startTime: number, endTime: number) => void;
}

const SPEEDS = [0.75, 1, 1.25, 1.5];

export function Timeline({
  duration,
  currentTime,
  isPlaying,
  loopClip,
  playbackRate,
  isMuted,
  hasRealAudio,
  waveform,
  clips,
  activeClip,
  onSeek,
  onTogglePlay,
  onToggleLoop,
  onChangeSpeed,
  onToggleMute,
  onSelectClip,
  onTrimActiveClip,
}: TimelineProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragMode, setDragMode] = useState<"scrub" | "start" | "end" | null>(
    null
  );

  const safeDuration = Math.max(1, duration);
  const playheadPct = Math.max(0, Math.min(100, (currentTime / safeDuration) * 100));

  const timeFromClientX = (clientX: number): number => {
    const el = trackRef.current;
    if (!el) return currentTime;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Number((ratio * safeDuration).toFixed(2));
  };

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    mode: "scrub" | "start" | "end"
  ) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragMode(mode);
    const t = timeFromClientX(e.clientX);
    applyPointerTime(t, mode);
  };

  const applyPointerTime = (t: number, mode: "scrub" | "start" | "end") => {
    if (mode === "scrub") {
      onSeek(t);
    } else if (mode === "start" && activeClip) {
      const clampedStart = Math.max(0, Math.min(activeClip.endTime - 2, t));
      onTrimActiveClip(clampedStart, activeClip.endTime);
      onSeek(clampedStart);
    } else if (mode === "end" && activeClip) {
      const clampedEnd = Math.min(safeDuration, Math.max(activeClip.startTime + 2, t));
      onTrimActiveClip(activeClip.startTime, clampedEnd);
      onSeek(Math.max(activeClip.startTime, clampedEnd - 0.5));
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragMode) return;
    const t = timeFromClientX(e.clientX);
    applyPointerTime(t, dragMode);
  };

  const handlePointerUp = () => {
    setDragMode(null);
  };

  const activeStartPct = activeClip
    ? (activeClip.startTime / safeDuration) * 100
    : 0;
  const activeEndPct = activeClip
    ? (activeClip.endTime / safeDuration) * 100
    : 0;

  return (
    <section
      aria-label="Timeline editor"
      className="shrink-0 border-t border-white/[0.08] bg-[#10131A] px-5 py-3.5 space-y-3"
    >
      {/* Transport & precision trim bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSeek(Math.max(0, currentTime - 5))}
            aria-label="Back 5 seconds"
            title="Back 5s"
            className="h-8 w-8 rounded-md text-[#C2C8D6] hover:text-white hover:bg-white/[0.07] flex items-center justify-center transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="h-9 px-4 rounded-md bg-white text-[#0B0D11] hover:bg-white/90 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Play
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSeek(Math.min(safeDuration, currentTime + 5))}
            aria-label="Forward 5 seconds"
            title="Forward 5s"
            className="h-8 w-8 rounded-md text-[#C2C8D6] hover:text-white hover:bg-white/[0.07] flex items-center justify-center transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleLoop}
            title="Loop active clip"
            className={`h-8 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              loopClip
                ? "bg-[#222938] text-white"
                : "text-[#9097A6] hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            Loop Clip
          </button>

          {hasRealAudio && (
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted ? "Unmute" : "Mute"}
              className="h-8 w-8 rounded-md text-[#C2C8D6] hover:text-white hover:bg-white/[0.07] flex items-center justify-center transition-colors"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-[#E5484D]" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Timecode readout */}
        <div className="font-mono text-xs tabular-nums text-[#E2E6EE] flex items-center gap-2">
          <span>{formatTimecode(currentTime)}</span>
          <span className="text-[#666D7D]">/</span>
          <span className="text-[#9097A6]">{formatTimecode(safeDuration)}</span>
          {activeClip && (
            <>
              <span className="text-[#666D7D] hidden sm:inline">·</span>
              <span className="text-[#9097A6] hidden sm:inline">
                Clip {(activeClip.endTime - activeClip.startTime).toFixed(1)}s
              </span>
            </>
          )}
        </div>

        {/* Speed + Quick In/Out buttons */}
        <div className="flex items-center gap-2">
          {activeClip && (
            <div className="hidden md:flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const nextIn = Math.max(0, Math.min(activeClip.endTime - 2, currentTime));
                  onTrimActiveClip(Number(nextIn.toFixed(2)), activeClip.endTime);
                }}
                title="Set clip In point to playhead (I)"
                className="h-8 px-2.5 rounded-md bg-[#181D27] hover:bg-[#222938] border border-white/[0.08] text-[11px] font-medium text-[#D5DAE5] transition-colors whitespace-nowrap"
              >
                Set In
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextOut = Math.min(
                    safeDuration,
                    Math.max(activeClip.startTime + 2, currentTime)
                  );
                  onTrimActiveClip(activeClip.startTime, Number(nextOut.toFixed(2)));
                }}
                title="Set clip Out point to playhead (O)"
                className="h-8 px-2.5 rounded-md bg-[#181D27] hover:bg-[#222938] border border-white/[0.08] text-[11px] font-medium text-[#D5DAE5] transition-colors whitespace-nowrap"
              >
                Set Out
              </button>
            </div>
          )}

          <div className="inline-flex items-center p-0.5 rounded-md bg-[#0B0D11] border border-white/[0.08]">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChangeSpeed(s)}
                className={`px-2 py-1 text-[11px] font-mono tabular-nums rounded transition-colors ${
                  playbackRate === s
                    ? "bg-[#222938] text-white"
                    : "text-[#8D95A5] hover:text-white"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive waveform & clip range track */}
      <div
        ref={trackRef}
        onPointerDown={(e) => handlePointerDown(e, "scrub")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative h-16 rounded-lg bg-[#0B0D11] border border-white/[0.08] select-none touch-none cursor-ew-resize overflow-hidden"
      >
        {/* Other clip ranges (subtle background markers) */}
        {clips.map((clip) => {
          if (activeClip && clip.id === activeClip.id) return null;
          const left = (clip.startTime / safeDuration) * 100;
          const width = Math.max(1, ((clip.endTime - clip.startTime) / safeDuration) * 100);
          return (
            <button
              key={clip.id}
              type="button"
              title={`Jump to: ${clip.title}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelectClip(clip.id);
              }}
              style={{ left: `${left}%`, width: `${width}%` }}
              className="absolute top-1 bottom-1 rounded bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-colors"
            />
          );
        })}

        {/* Waveform bars */}
        <div className="absolute inset-0 px-2 flex items-center justify-between gap-[2px] pointer-events-none">
          {waveform.map((amp, i) => {
            const barPct = (i / Math.max(1, waveform.length - 1)) * 100;
            const inActive =
              activeClip && barPct >= activeStartPct && barPct <= activeEndPct;
            return (
              <span
                key={i}
                style={{ height: `${Math.max(14, Math.round(amp * 76))}%` }}
                className={`flex-1 rounded-full transition-colors ${
                  inActive ? "bg-[#E2E6EE]/55" : "bg-white/[0.14]"
                }`}
              />
            );
          })}
        </div>

        {/* Active clip highlight + draggable In/Out trim handles */}
        {activeClip && (
          <div
            style={{
              left: `${activeStartPct}%`,
              width: `${Math.max(1.5, activeEndPct - activeStartPct)}%`,
            }}
            className="absolute top-0 bottom-0 bg-[#E5484D]/[0.14] border-y border-[#E5484D]/80 pointer-events-none"
          >
            {/* In handle */}
            <div
              role="slider"
              aria-label="Trim clip start"
              aria-valuemin={0}
              aria-valuemax={activeClip.endTime}
              aria-valuenow={activeClip.startTime}
              onPointerDown={(e) => handlePointerDown(e, "start")}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="pointer-events-auto absolute left-0 top-0 bottom-0 w-3 -translate-x-1/2 bg-[#E5484D] hover:bg-[#F05A5F] cursor-col-resize flex items-center justify-center rounded-l"
            >
              <span className="w-[2px] h-5 bg-white/90 rounded-full" />
            </div>

            {/* Out handle */}
            <div
              role="slider"
              aria-label="Trim clip end"
              aria-valuemin={activeClip.startTime}
              aria-valuemax={safeDuration}
              aria-valuenow={activeClip.endTime}
              onPointerDown={(e) => handlePointerDown(e, "end")}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="pointer-events-auto absolute right-0 top-0 bottom-0 w-3 translate-x-1/2 bg-[#E5484D] hover:bg-[#F05A5F] cursor-col-resize flex items-center justify-center rounded-r"
            >
              <span className="w-[2px] h-5 bg-white/90 rounded-full" />
            </div>
          </div>
        )}

        {/* Playhead needle */}
        <div
          style={{ left: `${playheadPct}%` }}
          className="absolute top-0 bottom-0 w-[2px] bg-white pointer-events-none -translate-x-1/2"
        >
          <span className="block w-2.5 h-2.5 bg-white rounded-sm -translate-x-[4px] -translate-y-0.5" />
        </div>
      </div>
    </section>
  );
}
