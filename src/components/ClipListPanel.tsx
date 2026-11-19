import { useMemo, useState } from "react";
import {
  Scissors,
  Plus,
  Copy,
  Trash2,
  Search,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import type { ClipItem, TargetPlatform } from "../types";
import { formatTimecode } from "../utils/videoEngine";

interface ClipListPanelProps {
  clips: ClipItem[];
  activeClipId: string | null;
  onSelectClip: (id: string) => void;
  onAddManualClip: () => void;
  onDuplicateClip: (id: string) => void;
  onDeleteClip: (id: string) => void;
  onRunAiAnalysis: (clipCount: number, platform: TargetPlatform) => void;
  isAnalyzing: boolean;
  analysisStage: string;
  analysisError: string | null;
  sourceTitle: string;
  sourceDuration: number;
  sourceSummary: string;
}

export function ClipListPanel({
  clips,
  activeClipId,
  onSelectClip,
  onAddManualClip,
  onDuplicateClip,
  onDeleteClip,
  onRunAiAnalysis,
  isAnalyzing,
  analysisStage,
  analysisError,
  sourceTitle,
  sourceDuration,
  sourceSummary,
}: ClipListPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [desiredCount, setDesiredCount] = useState<number>(3);
  const [targetPlatform, setTargetPlatform] =
    useState<TargetPlatform>("YouTube Shorts");

  const categories = useMemo(() => {
    const unique = Array.from(new Set(clips.map((c) => c.category).filter(Boolean)));
    return ["All", ...unique];
  }, [clips]);

  const filteredClips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return clips.filter((clip) => {
      if (categoryFilter !== "All" && clip.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        clip.title.toLowerCase().includes(q) ||
        clip.hook.toLowerCase().includes(q) ||
        clip.category.toLowerCase().includes(q)
      );
    });
  }, [clips, searchQuery, categoryFilter]);

  return (
    <aside className="w-full lg:w-[320px] xl:w-[348px] shrink-0 border-b lg:border-b-0 lg:border-r border-white/[0.08] bg-[#10131A] flex flex-col min-h-0">
      {/* Source summary + AI Clip Finder controls */}
      <div className="p-4 border-b border-white/[0.08] space-y-3.5">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold text-white truncate">
              {sourceTitle}
            </h2>
            <span className="font-mono text-xs tabular-nums text-[#9097A6] shrink-0">
              {formatTimecode(sourceDuration)}
            </span>
          </div>
          {sourceSummary && (
            <p className="text-xs text-[#9097A6] leading-relaxed line-clamp-2">
              {sourceSummary}
            </p>
          )}
        </div>

        {/* AI detection parameters */}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="block text-[11px] text-[#9097A6] mb-1">Platform</span>
            <select
              value={targetPlatform}
              onChange={(e) => setTargetPlatform(e.target.value as TargetPlatform)}
              className="w-full h-9 rounded-md bg-[#0B0D11] border border-white/[0.1] px-2.5 text-xs text-white focus:outline-none focus:border-[#E5484D]"
            >
              <option value="YouTube Shorts">YouTube Shorts</option>
              <option value="Instagram Reels">Instagram Reels</option>
              <option value="TikTok">TikTok</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] text-[#9097A6] mb-1">Clip Count</span>
            <select
              value={desiredCount}
              onChange={(e) => setDesiredCount(Number(e.target.value))}
              className="w-full h-9 rounded-md bg-[#0B0D11] border border-white/[0.1] px-2.5 text-xs text-white font-mono tabular-nums focus:outline-none focus:border-[#E5484D]"
            >
              <option value={2}>2 clips</option>
              <option value={3}>3 clips</option>
              <option value={4}>4 clips</option>
              <option value={5}>5 clips</option>
            </select>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isAnalyzing}
            onClick={() => onRunAiAnalysis(desiredCount, targetPlatform)}
            className="flex-1 h-9 px-3.5 rounded-md bg-[#E5484D] hover:bg-[#D63B40] disabled:opacity-55 disabled:cursor-not-allowed text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin" : ""}`} />
            {isAnalyzing ? "Analyzing..." : "Find Clips with AI"}
          </button>
          <button
            type="button"
            onClick={onAddManualClip}
            title="Create manual clip at playhead"
            className="h-9 px-3 rounded-md bg-[#181D27] hover:bg-[#222938] border border-white/[0.1] text-xs font-medium text-[#E2E6EE] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Cut
          </button>
        </div>

        {isAnalyzing && analysisStage && (
          <p className="text-xs text-[#C2C8D6]">{analysisStage}</p>
        )}

        {analysisError && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-[#E5484D]/[0.1] border border-[#E5484D]/35 text-xs text-[#FFB3B6] flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#E5484D]" />
            <span>{analysisError}</span>
          </div>
        )}
      </div>

      {/* Search + interactive category filter */}
      <div className="px-4 py-3 border-b border-white/[0.06] space-y-2.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#7A8294] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clips or hooks..."
            aria-label="Search clips"
            className="w-full h-8 pl-8 pr-3 rounded-md bg-[#0B0D11] border border-white/[0.08] text-xs text-white placeholder:text-[#666D7D] focus:outline-none focus:border-white/[0.24]"
          />
        </div>

        {categories.length > 2 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  categoryFilter === cat
                    ? "bg-[#222938] text-white"
                    : "text-[#9097A6] hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Clip queue list */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
        {isAnalyzing && clips.length === 0 ? (
          <div className="p-4 space-y-3">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg bg-[#161B24] border border-white/[0.06] animate-pulse space-y-2.5"
              >
                <div className="h-3.5 w-3/4 bg-white/[0.08] rounded" />
                <div className="h-3 w-1/2 bg-white/[0.06] rounded" />
                <div className="h-3 w-full bg-white/[0.05] rounded" />
              </div>
            ))}
          </div>
        ) : filteredClips.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <Scissors className="w-6 h-6 text-[#666D7D] mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">No clips match yet</p>
              <p className="text-xs text-[#9097A6]">
                Run AI clip detection to find peak moments or add a manual cut on the timeline.
              </p>
            </div>
            <button
              type="button"
              onClick={onAddManualClip}
              className="px-3.5 py-2 text-xs font-semibold bg-[#181D27] hover:bg-[#222938] border border-white/[0.1] text-white rounded-md transition-colors"
            >
              Create First Cut
            </button>
          </div>
        ) : (
          filteredClips.map((clip, index) => {
            const isSelected = clip.id === activeClipId;
            const duration = Math.max(0.1, clip.endTime - clip.startTime);

            return (
              <div
                key={clip.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectClip(clip.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectClip(clip.id);
                  }
                }}
                className={`group p-4 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#E5484D] ${
                  isSelected
                    ? "bg-[#181E2A]"
                    : "hover:bg-[#141821]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[11px] text-[#9097A6] font-mono tabular-nums">
                      <span className={isSelected ? "text-[#E5484D] font-semibold" : ""}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {formatTimecode(clip.startTime)}–{formatTimecode(clip.endTime)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{duration.toFixed(1)}s</span>
                    </div>
                    <h3 className="text-sm font-semibold text-white mt-1 leading-snug truncate">
                      {clip.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 shrink-0">
                    <button
                      type="button"
                      title="Duplicate clip"
                      aria-label={`Duplicate ${clip.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateClip(clip.id);
                      }}
                      className="p-1.5 rounded text-[#9097A6] hover:text-white hover:bg-white/[0.08] transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Delete clip"
                      aria-label={`Delete ${clip.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteClip(clip.id);
                      }}
                      className="p-1.5 rounded text-[#9097A6] hover:text-[#FF7A7E] hover:bg-white/[0.08] transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {clip.hook && (
                  <p className="text-xs text-[#B6BDCC] mt-1.5 line-clamp-2 leading-relaxed">
                    “{clip.hook}”
                  </p>
                )}

                <div className="flex items-center gap-2 text-[11px] text-[#8D95A5] mt-2">
                  <span>{clip.hookStrength}</span>
                  <span aria-hidden="true">·</span>
                  <span>{clip.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{clip.captions.length} cues</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
