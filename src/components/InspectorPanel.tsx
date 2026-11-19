import { useState } from "react";
import {
  Download,
  Copy,
  Check,
  Plus,
  Trash2,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  FileText,
} from "lucide-react";
import type {
  AspectRatio,
  CaptionPosition,
  CaptionPreset,
  CaptionSegment,
  CaptionStyleConfig,
  ClipItem,
  FitMode,
  TargetPlatform,
} from "../types";
import { formatTimecode, getCanvasDimensions } from "../utils/videoEngine";

export type InspectorSection = "frame" | "captions" | "export";

interface InspectorPanelProps {
  section: InspectorSection;
  onChangeSection: (section: InspectorSection) => void;
  activeClip: ClipItem | null;
  currentTime: number;
  aspectRatio: AspectRatio;
  fitMode: FitMode;
  captionStyle: CaptionStyleConfig;
  onChangeAspectRatio: (ar: AspectRatio) => void;
  onChangeFitMode: (mode: FitMode) => void;
  onChangeCaptionStyle: (next: CaptionStyleConfig) => void;
  onUpdateClip: (patch: Partial<ClipItem>) => void;
  onSeek: (time: number) => void;
  onPolishClip: (platform: TargetPlatform, tone: string) => Promise<void>;
  isPolishing: boolean;
  polishError: string | null;
  onExportVideo: () => void;
  onCancelExport: () => void;
  isExporting: boolean;
  exportProgress: number;
  exportError: string | null;
  lastExportUrl: string | null;
  lastExportName: string | null;
  onDownloadSrt: () => void;
}

const ACCENT_SWATCHES = [
  { label: "Coral", value: "#F25F5C" },
  { label: "Amber", value: "#F5B841" },
  { label: "Lime", value: "#A3E635" },
  { label: "Ice", value: "#60A5FA" },
  { label: "White", value: "#FFFFFF" },
];

export function InspectorPanel({
  section,
  onChangeSection,
  activeClip,
  currentTime,
  aspectRatio,
  fitMode,
  captionStyle,
  onChangeAspectRatio,
  onChangeFitMode,
  onChangeCaptionStyle,
  onUpdateClip,
  onSeek,
  onPolishClip,
  isPolishing,
  polishError,
  onExportVideo,
  onCancelExport,
  isExporting,
  exportProgress,
  exportError,
  lastExportUrl,
  lastExportName,
  onDownloadSrt,
}: InspectorPanelProps) {
  const [polishPlatform, setPolishPlatform] =
    useState<TargetPlatform>("YouTube Shorts");
  const [polishTone, setPolishTone] = useState("Direct & Punchy");
  const [copiedKit, setCopiedKit] = useState(false);

  const dims = getCanvasDimensions(aspectRatio, true);

  const handleUpdateCaption = (
    capId: string,
    patch: Partial<CaptionSegment>
  ) => {
    if (!activeClip) return;
    onUpdateClip({
      captions: activeClip.captions.map((c) =>
        c.id === capId ? { ...c, ...patch } : c
      ),
    });
  };

  const handleDeleteCaption = (capId: string) => {
    if (!activeClip) return;
    onUpdateClip({
      captions: activeClip.captions.filter((c) => c.id !== capId),
    });
  };

  const handleAddCaptionAtPlayhead = () => {
    if (!activeClip) return;
    const clampedStart = Math.max(
      activeClip.startTime,
      Math.min(activeClip.endTime - 1, currentTime)
    );
    const nextCap: CaptionSegment = {
      id: `cap-${Date.now()}`,
      startTime: Number(clampedStart.toFixed(2)),
      endTime: Number(Math.min(activeClip.endTime, clampedStart + 2.5).toFixed(2)),
      text: "New caption line",
      highlightWord: "caption",
    };
    const nextList = [...activeClip.captions, nextCap].sort(
      (a, b) => a.startTime - b.startTime
    );
    onUpdateClip({ captions: nextList });
  };

  const handleCopySocialKit = async () => {
    if (!activeClip) return;
    const tags = activeClip.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");
    const payload = `${activeClip.title}\n\n${activeClip.description}\n\n${tags}`.trim();
    try {
      await navigator.clipboard.writeText(payload);
      setCopiedKit(true);
      window.setTimeout(() => setCopiedKit(false), 1800);
    } catch {
      setCopiedKit(false);
    }
  };

  return (
    <aside className="w-full lg:w-[352px] xl:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/[0.08] bg-[#10131A] flex flex-col min-h-0">
      {/* Segmented section tabs */}
      <div className="p-3 border-b border-white/[0.08]">
        <div className="grid grid-cols-3 gap-1 p-1 bg-[#0B0D11] border border-white/[0.07] rounded-lg">
          {(
            [
              { id: "frame", label: "Clip & Frame" },
              { id: "captions", label: "Captions" },
              { id: "export", label: "Export" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeSection(tab.id)}
              className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                section === tab.id
                  ? "bg-[#1C222E] text-white"
                  : "text-[#9097A6] hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {!activeClip ? (
        <div className="p-8 text-center text-xs text-[#9097A6]">
          Select or create a clip to adjust framing, captions, and export settings.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {section === "frame" && (
            <>
              {/* Aspect Ratio & Framing */}
              <div className="space-y-3.5">
                <h3 className="font-display text-xs font-semibold text-[#D5DAE5]">
                  Canvas Format
                </h3>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["9:16", "1:1", "16:9"] as AspectRatio[]).map((ar) => (
                    <button
                      key={ar}
                      type="button"
                      onClick={() => onChangeAspectRatio(ar)}
                      className={`h-9 rounded-md text-xs font-mono tabular-nums font-medium border transition-colors ${
                        aspectRatio === ar
                          ? "bg-[#1C222E] border-white/[0.24] text-white"
                          : "bg-[#0B0D11] border-white/[0.08] text-[#9097A6] hover:text-white"
                      }`}
                    >
                      {ar}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: "crop", label: "Smart Crop" },
                      { id: "blur-fit", label: "Blur Backdrop" },
                    ] as Array<{ id: FitMode; label: string }>
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => onChangeFitMode(mode.id)}
                      className={`h-9 rounded-md text-xs font-medium border transition-colors ${
                        fitMode === mode.id
                          ? "bg-[#1C222E] border-white/[0.24] text-white"
                          : "bg-[#0B0D11] border-white/[0.08] text-[#9097A6] hover:text-white"
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[#9097A6]">Horizontal Focus</span>
                      <span className="font-mono tabular-nums text-[#E2E6EE]">
                        {Math.round(activeClip.focusX)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={activeClip.focusX}
                      onChange={(e) =>
                        onUpdateClip({ focusX: Number(e.target.value) })
                      }
                      className="w-full studio-range"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[#9097A6]">Zoom</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono tabular-nums text-[#E2E6EE]">
                          {activeClip.zoom.toFixed(2)}x
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateClip({ focusX: 50, zoom: 1 })}
                          title="Reset framing"
                          className="text-[#9097A6] hover:text-white transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={2}
                      step={0.02}
                      value={activeClip.zoom}
                      onChange={(e) =>
                        onUpdateClip({ zoom: Number(e.target.value) })
                      }
                      className="w-full studio-range"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-white/[0.07]" />

              {/* Clip Metadata & Rationale */}
              <div className="space-y-3">
                <h3 className="font-display text-xs font-semibold text-[#D5DAE5]">
                  Clip Details
                </h3>

                <label className="block">
                  <span className="block text-[11px] text-[#9097A6] mb-1">Title</span>
                  <input
                    type="text"
                    value={activeClip.title}
                    onChange={(e) => onUpdateClip({ title: e.target.value })}
                    className="w-full h-9 rounded-md bg-[#0B0D11] border border-white/[0.1] px-3 text-xs text-white focus:outline-none focus:border-[#E5484D]"
                  />
                </label>

                <label className="block">
                  <span className="block text-[11px] text-[#9097A6] mb-1">
                    Opening Hook
                  </span>
                  <textarea
                    rows={2}
                    value={activeClip.hook}
                    onChange={(e) => onUpdateClip({ hook: e.target.value })}
                    className="w-full rounded-md bg-[#0B0D11] border border-white/[0.1] px-3 py-2 text-xs text-white leading-relaxed focus:outline-none focus:border-[#E5484D]"
                  />
                </label>

                {activeClip.reason && (
                  <div className="space-y-1">
                    <span className="block text-[11px] text-[#9097A6]">
                      Editorial Note · {activeClip.hookStrength}
                    </span>
                    <p className="text-xs text-[#C2C8D6] leading-relaxed">
                      {activeClip.reason}
                    </p>
                  </div>
                )}
              </div>

              <hr className="border-white/[0.07]" />

              {/* AI Hook & Caption Rewrite */}
              <div className="space-y-3">
                <h3 className="font-display text-xs font-semibold text-[#D5DAE5]">
                  AI Rewrite Package
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={polishPlatform}
                    onChange={(e) =>
                      setPolishPlatform(e.target.value as TargetPlatform)
                    }
                    aria-label="Target platform for rewrite"
                    className="h-9 rounded-md bg-[#0B0D11] border border-white/[0.1] px-2.5 text-xs text-white focus:outline-none focus:border-[#E5484D]"
                  >
                    <option value="YouTube Shorts">YouTube Shorts</option>
                    <option value="Instagram Reels">Instagram Reels</option>
                    <option value="TikTok">TikTok</option>
                  </select>

                  <select
                    value={polishTone}
                    onChange={(e) => setPolishTone(e.target.value)}
                    aria-label="Tone for rewrite"
                    className="h-9 rounded-md bg-[#0B0D11] border border-white/[0.1] px-2.5 text-xs text-white focus:outline-none focus:border-[#E5484D]"
                  >
                    <option value="Direct & Punchy">Direct & Punchy</option>
                    <option value="High-Energy">High-Energy</option>
                    <option value="Editorial">Editorial</option>
                    <option value="Storytelling">Storytelling</option>
                  </select>
                </div>

                <button
                  type="button"
                  disabled={isPolishing}
                  onClick={() => onPolishClip(polishPlatform, polishTone)}
                  className="w-full h-9 rounded-md bg-[#181D27] hover:bg-[#222938] border border-white/[0.12] disabled:opacity-55 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isPolishing ? "animate-spin" : ""}`}
                  />
                  {isPolishing ? "Rewriting hook & cues..." : "Rewrite Hook & Captions"}
                </button>

                {polishError && (
                  <div
                    role="alert"
                    className="p-2.5 rounded-md bg-[#E5484D]/[0.1] border border-[#E5484D]/35 text-xs text-[#FFB3B6] flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 text-[#E5484D]" />
                    <span>{polishError}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {section === "captions" && (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xs font-semibold text-[#D5DAE5]">
                    Burn-in Subtitles
                  </h3>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={captionStyle.enabled}
                    onClick={() =>
                      onChangeCaptionStyle({
                        ...captionStyle,
                        enabled: !captionStyle.enabled,
                      })
                    }
                    className={`h-6 w-11 rounded-full transition-colors p-0.5 ${
                      captionStyle.enabled ? "bg-[#E5484D]" : "bg-white/[0.14]"
                    }`}
                  >
                    <span
                      className={`block h-5 w-5 rounded-full bg-white transition-transform ${
                        captionStyle.enabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Preset selector */}
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: "kinetic", label: "Kinetic Bold" },
                      { id: "highlight-box", label: "Highlight Box" },
                      { id: "studio", label: "Studio Plate" },
                      { id: "cinema", label: "Subtle Cinema" },
                    ] as Array<{ id: CaptionPreset; label: string }>
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        onChangeCaptionStyle({ ...captionStyle, preset: p.id })
                      }
                      className={`h-9 rounded-md text-xs font-medium border transition-colors ${
                        captionStyle.preset === p.id
                          ? "bg-[#1C222E] border-white/[0.24] text-white"
                          : "bg-[#0B0D11] border-white/[0.08] text-[#9097A6] hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Position */}
                <div className="grid grid-cols-3 gap-1.5">
                  {(["bottom", "center", "top"] as CaptionPosition[]).map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() =>
                        onChangeCaptionStyle({ ...captionStyle, position: pos })
                      }
                      className={`h-8 rounded-md text-xs font-medium capitalize border transition-colors ${
                        captionStyle.position === pos
                          ? "bg-[#1C222E] border-white/[0.24] text-white"
                          : "bg-[#0B0D11] border-white/[0.08] text-[#9097A6] hover:text-white"
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>

                {/* Font size */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[#9097A6]">Text Size</span>
                    <span className="font-mono tabular-nums text-[#E2E6EE]">
                      {captionStyle.fontSize}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={26}
                    max={58}
                    step={2}
                    value={captionStyle.fontSize}
                    onChange={(e) =>
                      onChangeCaptionStyle({
                        ...captionStyle,
                        fontSize: Number(e.target.value),
                      })
                    }
                    className="w-full studio-range"
                  />
                </div>

                {/* Accent color + case */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {ACCENT_SWATCHES.map((swatch) => (
                      <button
                        key={swatch.value}
                        type="button"
                        title={swatch.label}
                        aria-label={`Caption highlight ${swatch.label}`}
                        onClick={() =>
                          onChangeCaptionStyle({
                            ...captionStyle,
                            accentColor: swatch.value,
                          })
                        }
                        style={{ backgroundColor: swatch.value }}
                        className={`w-6 h-6 rounded-full transition-transform ${
                          captionStyle.accentColor === swatch.value
                            ? "ring-2 ring-white ring-offset-2 ring-offset-[#10131A] scale-110"
                            : "opacity-80 hover:opacity-100"
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onChangeCaptionStyle({
                        ...captionStyle,
                        uppercase: !captionStyle.uppercase,
                      })
                    }
                    className={`h-8 px-2.5 rounded-md text-xs font-mono border transition-colors ${
                      captionStyle.uppercase
                        ? "bg-[#1C222E] border-white/[0.24] text-white"
                        : "bg-[#0B0D11] border-white/[0.08] text-[#9097A6]"
                    }`}
                  >
                    AA
                  </button>
                </div>
              </div>

              <hr className="border-white/[0.07]" />

              {/* Timed Caption Cues */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xs font-semibold text-[#D5DAE5]">
                    Timed Cues ({activeClip.captions.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddCaptionAtPlayhead}
                    className="h-7 px-2.5 rounded bg-[#181D27] hover:bg-[#222938] border border-white/[0.1] text-[11px] font-medium text-white flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add Cue
                  </button>
                </div>

                {activeClip.captions.length === 0 ? (
                  <p className="text-xs text-[#9097A6]">
                    No caption cues on this clip yet. Add one at the playhead or run AI analysis.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {activeClip.captions.map((cap) => {
                      const isLive =
                        currentTime >= cap.startTime && currentTime <= cap.endTime;
                      return (
                        <div
                          key={cap.id}
                          className={`p-2.5 rounded-lg border transition-colors space-y-2 ${
                            isLive
                              ? "bg-[#181E2A] border-[#E5484D]/55"
                              : "bg-[#0B0D11] border-white/[0.08]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => onSeek(cap.startTime + 0.05)}
                              className="font-mono text-[11px] tabular-nums text-[#9097A6] hover:text-white transition-colors"
                            >
                              {formatTimecode(cap.startTime)} → {formatTimecode(cap.endTime)}
                            </button>
                            <button
                              type="button"
                              aria-label="Delete caption cue"
                              onClick={() => handleDeleteCaption(cap.id)}
                              className="p-1 text-[#7A8294] hover:text-[#FF7A7E] transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <input
                            type="text"
                            value={cap.text}
                            onChange={(e) =>
                              handleUpdateCaption(cap.id, { text: e.target.value })
                            }
                            aria-label="Caption line text"
                            className="w-full h-8 rounded bg-[#12161E] border border-white/[0.08] px-2.5 text-xs text-white focus:outline-none focus:border-[#E5484D]"
                          />

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-[#7A8294] shrink-0">
                              Emphasis:
                            </span>
                            <input
                              type="text"
                              value={cap.highlightWord}
                              onChange={(e) =>
                                handleUpdateCaption(cap.id, {
                                  highlightWord: e.target.value,
                                })
                              }
                              placeholder="Key word"
                              className="flex-1 h-7 rounded bg-[#12161E] border border-white/[0.08] px-2 text-[11px] text-[#D5DAE5] focus:outline-none focus:border-[#E5484D]"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {section === "export" && (
            <>
              <div className="space-y-3.5">
                <h3 className="font-display text-xs font-semibold text-[#D5DAE5]">
                  Render Vertical Clip
                </h3>

                <div className="p-3.5 rounded-lg bg-[#0B0D11] border border-white/[0.08] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#9097A6]">Resolution</span>
                    <span className="font-mono tabular-nums text-white">
                      {dims.width} × {dims.height} ({aspectRatio})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#9097A6]">Duration</span>
                    <span className="font-mono tabular-nums text-white">
                      {(activeClip.endTime - activeClip.startTime).toFixed(1)}s
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#9097A6]">Captions</span>
                    <span className="text-white">
                      {captionStyle.enabled
                        ? `Burned-in (${activeClip.captions.length} cues)`
                        : "Off"}
                    </span>
                  </div>
                </div>

                {isExporting ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#D5DAE5]">Rendering WebM clip...</span>
                      <span className="font-mono tabular-nums text-white">
                        {Math.round(exportProgress * 100)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden">
                      <div
                        style={{ width: `${Math.round(exportProgress * 100)}%` }}
                        className="h-full bg-[#E5484D] transition-all duration-150"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={onCancelExport}
                      className="w-full h-9 rounded-md bg-[#181D27] hover:bg-[#222938] border border-white/[0.1] text-xs font-medium text-[#D5DAE5] transition-colors"
                    >
                      Cancel Render
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={onExportVideo}
                      className="w-full h-10 rounded-md bg-[#E5484D] hover:bg-[#D63B40] text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Export Video Clip (.webm)
                    </button>

                    <button
                      type="button"
                      onClick={onDownloadSrt}
                      className="w-full h-9 rounded-md bg-[#181D27] hover:bg-[#222938] border border-white/[0.1] text-xs font-medium text-[#E2E6EE] flex items-center justify-center gap-2 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Download Subtitles (.srt)
                    </button>
                  </div>
                )}

                {exportError && (
                  <div
                    role="alert"
                    className="p-2.5 rounded-md bg-[#E5484D]/[0.1] border border-[#E5484D]/35 text-xs text-[#FFB3B6] flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 text-[#E5484D]" />
                    <span>{exportError}</span>
                  </div>
                )}

                {lastExportUrl && lastExportName && !isExporting && (
                  <div className="p-3 rounded-lg bg-[#16A34A]/[0.1] border border-[#16A34A]/30 flex items-center justify-between gap-3">
                    <span className="text-xs text-[#A7F3D0] truncate">
                      Ready: {lastExportName}
                    </span>
                    <a
                      href={lastExportUrl}
                      download={lastExportName}
                      className="text-xs font-semibold text-white underline underline-offset-2 shrink-0"
                    >
                      Save again
                    </a>
                  </div>
                )}
              </div>

              <hr className="border-white/[0.07]" />

              {/* Ready-to-Post Social Kit */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xs font-semibold text-[#D5DAE5]">
                    Social Post Copy
                  </h3>
                  <button
                    type="button"
                    onClick={handleCopySocialKit}
                    className="h-7 px-2.5 rounded bg-[#181D27] hover:bg-[#222938] border border-white/[0.1] text-[11px] font-medium text-white flex items-center gap-1.5 transition-colors"
                  >
                    {copiedKit ? (
                      <>
                        <Check className="w-3 h-3 text-[#4ADE80]" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy Kit
                      </>
                    )}
                  </button>
                </div>

                <label className="block">
                  <span className="block text-[11px] text-[#9097A6] mb-1">
                    Post Caption
                  </span>
                  <textarea
                    rows={3}
                    value={activeClip.description}
                    onChange={(e) =>
                      onUpdateClip({ description: e.target.value })
                    }
                    className="w-full rounded-md bg-[#0B0D11] border border-white/[0.1] px-3 py-2 text-xs text-white leading-relaxed focus:outline-none focus:border-[#E5484D]"
                  />
                </label>

                <label className="block">
                  <span className="block text-[11px] text-[#9097A6] mb-1">
                    Hashtags (comma separated)
                  </span>
                  <input
                    type="text"
                    value={activeClip.hashtags.join(", ")}
                    onChange={(e) =>
                      onUpdateClip({
                        hashtags: e.target.value
                          .split(",")
                          .map((s) => s.replace(/^#/, "").trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full h-9 rounded-md bg-[#0B0D11] border border-white/[0.1] px-3 text-xs text-white focus:outline-none focus:border-[#E5484D]"
                  />
                </label>
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
