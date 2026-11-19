import { useRef, useState } from "react";
import { Upload, Grid, Play, Pause } from "lucide-react";
import type { AspectRatio, FitMode } from "../types";
import { getCanvasDimensions } from "../utils/videoEngine";

interface VideoStageProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  aspectRatio: AspectRatio;
  fitMode: FitMode;
  focusX: number;
  zoom: number;
  isPlaying: boolean;
  sourceKind: "file" | "sample";
  activeClipTitle: string | null;
  onTogglePlay: () => void;
  onChangeFocusX: (focusX: number) => void;
  onOpenSourceModal: () => void;
}

export function VideoStage({
  canvasRef,
  aspectRatio,
  fitMode,
  focusX,
  zoom,
  isPlaying,
  sourceKind,
  activeClipTitle,
  onTogglePlay,
  onChangeFocusX,
  onOpenSourceModal,
}: VideoStageProps) {
  const [showSafeGuides, setShowSafeGuides] = useState(false);
  const dragStartRef = useRef<{ x: number; startFocus: number; moved: boolean } | null>(
    null
  );

  const dims = getCanvasDimensions(aspectRatio, false);
  const exportDims = getCanvasDimensions(aspectRatio, true);

  const frameSizeClass =
    aspectRatio === "9:16"
      ? "h-full max-h-[540px] aspect-[9/16]"
      : aspectRatio === "1:1"
        ? "h-full max-h-[480px] aspect-square"
        : "w-full max-w-[740px] aspect-video";

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStartRef.current = {
      x: e.clientX,
      startFocus: focusX,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    if (Math.abs(dx) > 4) {
      dragStartRef.current.moved = true;
    }
    if (dragStartRef.current.moved && fitMode === "crop") {
      // Natural drag pan: dragging left shifts focus right
      const deltaPct = -(dx / 240) * 100;
      const next = Math.max(
        0,
        Math.min(100, Math.round(dragStartRef.current.startFocus + deltaPct))
      );
      onChangeFocusX(next);
    }
  };

  const handlePointerUp = () => {
    const wasDrag = dragStartRef.current?.moved ?? false;
    dragStartRef.current = null;
    if (!wasDrag) {
      onTogglePlay();
    }
  };

  return (
    <main className="flex-1 min-w-0 min-h-0 bg-[#0B0D11] flex flex-col">
      {/* Subtle single-row stage context bar */}
      <div className="h-11 shrink-0 px-5 border-b border-white/[0.06] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-[#9097A6] min-w-0 truncate">
          <span className="text-[#E2E6EE] font-medium truncate">
            {activeClipTitle || "Full Source Preview"}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums shrink-0">
            {aspectRatio} ({exportDims.width}×{exportDims.height})
          </span>
          {sourceKind === "sample" && (
            <>
              <span aria-hidden="true" className="hidden xl:inline">·</span>
              <span className="hidden xl:inline text-[#9097A6] shrink-0">
                Sample Studio Reel
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowSafeGuides((v) => !v)}
            title="Toggle Shorts / Reels UI safe zones"
            className={`h-7 px-2.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              showSafeGuides
                ? "bg-[#1C222E] text-white"
                : "text-[#9097A6] hover:text-white hover:bg-white/[0.05]"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            Safe Zones
          </button>

          <button
            type="button"
            onClick={onOpenSourceModal}
            className="h-7 px-2.5 rounded bg-[#161B24] hover:bg-[#1F2633] border border-white/[0.08] text-xs font-medium text-[#E2E6EE] flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            Change Video
          </button>
        </div>
      </div>

      {/* Centered dominant video monitor canvas */}
      <div className="flex-1 min-h-0 p-5 flex flex-col items-center justify-center relative overflow-hidden">
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            dragStartRef.current = null;
          }}
          title={
            fitMode === "crop"
              ? "Click to play/pause or drag horizontally to pan crop focus"
              : "Click to play or pause"
          }
          className={`relative ${frameSizeClass} rounded-xl overflow-hidden bg-[#060709] border border-white/[0.12] select-none touch-none group ${
            fitMode === "crop" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
          }`}
        >
          <canvas
            ref={canvasRef}
            width={dims.width}
            height={dims.height}
            className="w-full h-full block"
          />

          {/* Optional Shorts / Reels UI Safe Zone Guides */}
          {showSafeGuides && aspectRatio === "9:16" && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-x-0 top-0 h-[12%] border-b border-dashed border-white/25 bg-black/20" />
              <div className="absolute right-0 top-[44%] bottom-[16%] w-[18%] border-l border-y border-dashed border-white/25 bg-black/20" />
              <div className="absolute inset-x-0 bottom-0 h-[16%] border-t border-dashed border-white/25 bg-black/20" />
              <span className="absolute top-2 left-2.5 text-[10px] font-mono text-white/60">
                UI Safe Area
              </span>
            </div>
          )}

          {/* Subtle center play/pause indicator on hover or when paused */}
          <div
            className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-150 ${
              isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-[#0B0D11]/70 border border-white/20 backdrop-blur-sm flex items-center justify-center text-white">
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current translate-x-0.5" />
              )}
            </div>
          </div>
        </div>

        {/* Quiet framing hint below monitor */}
        <p className="mt-3 text-[11px] text-[#7A8294] font-mono tabular-nums">
          {fitMode === "crop"
            ? `Drag frame to pan · Focus ${Math.round(focusX)}% · Zoom ${zoom.toFixed(2)}x · Space to play`
            : `Blur backdrop fit · Zoom ${zoom.toFixed(2)}x · Space to play`}
        </p>
      </div>
    </main>
  );
}
