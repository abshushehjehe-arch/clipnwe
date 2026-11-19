import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { TopBar } from "./components/TopBar";
import { SourceModal } from "./components/SourceModal";
import { ClipListPanel } from "./components/ClipListPanel";
import { VideoStage } from "./components/VideoStage";
import { Timeline } from "./components/Timeline";
import {
  InspectorPanel,
  type InspectorSection,
} from "./components/InspectorPanel";
import { SAMPLE_SESSIONS } from "./data/samples";
import type {
  AspectRatio,
  CaptionStyleConfig,
  ClipItem,
  FitMode,
  SampleSessionPreset,
  TargetPlatform,
  VideoSource,
  WorkspaceTab,
} from "./types";
import {
  extractAudioWaveform,
  generateSrtContent,
  getCanvasDimensions,
  imageUrlToDataUrl,
  renderAndExportClipWebm,
  renderClipFrame,
  sampleKeyframesFromVideo,
} from "./utils/videoEngine";

function createVideoSourceFromSample(sample: SampleSessionPreset): VideoSource {
  return {
    id: sample.id,
    kind: "sample",
    title: sample.title,
    duration: sample.duration,
    width: 1280,
    height: 720,
    sampleImage: sample.image,
    waveform: sample.waveform,
    audioPeaks: sample.audioPeaks,
    transcript: sample.transcript,
    summary: sample.summary,
    detectedLanguage: "English",
  };
}

export default function App() {
  const initialSample = SAMPLE_SESSIONS[0];

  const [source, setSource] = useState<VideoSource>(() =>
    createVideoSourceFromSample(initialSample)
  );
  const [clips, setClips] = useState<ClipItem[]>(() =>
    structuredClone(initialSample.starterClips)
  );
  const [activeClipId, setActiveClipId] = useState<string | null>(
    initialSample.starterClips[0]?.id ?? null
  );

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("studio");
  const [inspectorSection, setInspectorSection] =
    useState<InspectorSection>("frame");
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isWindowDragging, setIsWindowDragging] = useState(false);

  // Playback state
  const [currentTime, setCurrentTime] = useState<number>(
    initialSample.starterClips[0]?.startTime ?? 0
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopClip, setLoopClip] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Composition settings
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [fitMode, setFitMode] = useState<FitMode>("crop");
  const [captionStyle, setCaptionStyle] = useState<CaptionStyleConfig>({
    enabled: true,
    preset: "kinetic",
    position: "bottom",
    fontSize: 38,
    accentColor: "#F5B841",
    uppercase: false,
  });

  // AI states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState("");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);

  // Export states
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastExportUrl, setLastExportUrl] = useState<string | null>(null);
  const [lastExportName, setLastExportName] = useState<string | null>(null);

  // DOM & media refs
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sampleImageElRef = useRef<HTMLImageElement | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(currentTime);
  currentTimeRef.current = currentTime;

  const activeClip = useMemo(
    () => clips.find((c) => c.id === activeClipId) ?? null,
    [clips, activeClipId]
  );

  // Sync TopBar navigation with Inspector focus
  const handleSelectTab = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    if (tab === "captions") setInspectorSection("captions");
    else if (tab === "export") setInspectorSection("export");
    else if (tab === "studio") setInspectorSection("frame");
  };

  // Preload sample image into HTMLImageElement when sample source changes
  useEffect(() => {
    if (source.kind !== "sample" || !source.sampleImage) {
      sampleImageElRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = source.sampleImage;
    img.onload = () => {
      sampleImageElRef.current = img;
    };
  }, [source.kind, source.sampleImage]);

  // Sync video playbackRate & muted properties
  useEffect(() => {
    const vid = hiddenVideoRef.current;
    if (!vid) return;
    vid.playbackRate = playbackRate;
    vid.muted = isMuted;
  }, [playbackRate, isMuted, source.url]);

  // Seek helper for both real <video> and virtual sample timeline
  const handleSeek = useCallback(
    (nextTime: number) => {
      const clamped = Math.max(0, Math.min(source.duration, nextTime));
      currentTimeRef.current = clamped;
      setCurrentTime(clamped);
      const vid = hiddenVideoRef.current;
      if (source.kind === "file" && vid && Number.isFinite(vid.duration)) {
        vid.currentTime = clamped;
      }
    },
    [source.duration, source.kind]
  );

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      const vid = hiddenVideoRef.current;
      if (source.kind === "file" && vid) {
        if (next) {
          if (
            activeClip &&
            (vid.currentTime < activeClip.startTime ||
              vid.currentTime >= activeClip.endTime - 0.1)
          ) {
            vid.currentTime = activeClip.startTime;
            currentTimeRef.current = activeClip.startTime;
            setCurrentTime(activeClip.startTime);
          }
          vid.play().catch(() => {});
        } else {
          vid.pause();
        }
      } else if (next && activeClip) {
        if (
          currentTimeRef.current < activeClip.startTime ||
          currentTimeRef.current >= activeClip.endTime - 0.1
        ) {
          currentTimeRef.current = activeClip.startTime;
          setCurrentTime(activeClip.startTime);
        }
      }
      return next;
    });
  }, [source.kind, activeClip]);

  // Real-time canvas compositor & playback loop
  useEffect(() => {
    let rafId = 0;
    lastFrameTimeRef.current = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - lastFrameTimeRef.current) / 1000);
      lastFrameTimeRef.current = now;

      let timeNow = currentTimeRef.current;

      if (source.kind === "file" && hiddenVideoRef.current) {
        const vid = hiddenVideoRef.current;
        if (!vid.paused) {
          timeNow = vid.currentTime;
          if (loopClip && activeClip && timeNow >= activeClip.endTime) {
            vid.currentTime = activeClip.startTime;
            timeNow = activeClip.startTime;
          } else if (timeNow >= source.duration) {
            vid.pause();
            setIsPlaying(false);
          }
          currentTimeRef.current = timeNow;
          setCurrentTime(timeNow);
        }
      } else if (source.kind === "sample" && isPlaying) {
        timeNow += dt * playbackRate;
        if (loopClip && activeClip && timeNow >= activeClip.endTime) {
          timeNow = activeClip.startTime;
        } else if (timeNow >= source.duration) {
          timeNow = activeClip ? activeClip.startTime : 0;
          if (!loopClip) setIsPlaying(false);
        }
        currentTimeRef.current = timeNow;
        setCurrentTime(timeNow);
      }

      const canvas = previewCanvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        const dims = getCanvasDimensions(aspectRatio, false);
        if (canvas.width !== dims.width || canvas.height !== dims.height) {
          canvas.width = dims.width;
          canvas.height = dims.height;
        }

        const activeCaption =
          activeClip?.captions.find(
            (c) => timeNow >= c.startTime && timeNow <= c.endTime
          ) ?? null;

        const vid = hiddenVideoRef.current;
        const mediaEl =
          source.kind === "file" && vid && vid.readyState >= 2
            ? vid
            : sampleImageElRef.current;

        renderClipFrame({
          ctx,
          source: mediaEl,
          sourceWidth:
            source.kind === "file" && vid
              ? vid.videoWidth || source.width
              : sampleImageElRef.current?.naturalWidth || 1280,
          sourceHeight:
            source.kind === "file" && vid
              ? vid.videoHeight || source.height
              : sampleImageElRef.current?.naturalHeight || 720,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          fitMode,
          focusX: activeClip?.focusX ?? 50,
          zoom: activeClip?.zoom ?? 1,
          currentTime: timeNow,
          isSampleMotion: source.kind === "sample",
          activeCaption,
          captionStyle,
        });
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [
    source,
    isPlaying,
    loopClip,
    playbackRate,
    activeClip,
    aspectRatio,
    fitMode,
    captionStyle,
  ]);

  // Global keyboard shortcuts (Space, I, O, ArrowLeft/Right)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleSeek(currentTimeRef.current - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleSeek(currentTimeRef.current + 1);
      } else if ((e.key === "i" || e.key === "I") && activeClip) {
        e.preventDefault();
        const nextStart = Math.max(
          0,
          Math.min(activeClip.endTime - 2, currentTimeRef.current)
        );
        setClips((prev) =>
          prev.map((c) =>
            c.id === activeClip.id
              ? { ...c, startTime: Number(nextStart.toFixed(2)) }
              : c
          )
        );
      } else if ((e.key === "o" || e.key === "O") && activeClip) {
        e.preventDefault();
        const nextEnd = Math.min(
          source.duration,
          Math.max(activeClip.startTime + 2, currentTimeRef.current)
        );
        setClips((prev) =>
          prev.map((c) =>
            c.id === activeClip.id
              ? { ...c, endTime: Number(nextEnd.toFixed(2)) }
              : c
          )
        );
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleTogglePlay, handleSeek, activeClip, source.duration]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (source.url) URL.revokeObjectURL(source.url);
    };
  }, [source.url]);

  // Load real uploaded / recorded video file
  const handleLoadLocalFile = async (file: File, transcriptHint = "") => {
    setIsPlaying(false);
    setAnalysisError(null);
    setExportError(null);
    setPolishError(null);

    const objectUrl = URL.createObjectURL(file);

    // Probe real duration & dimensions
    const meta = await new Promise<{
      duration: number;
      width: number;
      height: number;
    }>((resolve) => {
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.src = objectUrl;
      probe.onloadedmetadata = () => {
        resolve({
          duration: Number.isFinite(probe.duration) && probe.duration > 0 ? probe.duration : 30,
          width: probe.videoWidth || 1280,
          height: probe.videoHeight || 720,
        });
      };
      probe.onerror = () => resolve({ duration: 30, width: 1280, height: 720 });
    });

    const { waveform, peaks } = await extractAudioWaveform(file, 120);

    const cleanName = file.name.replace(/\.[^/.]+$/, "");
    const nextSource: VideoSource = {
      id: `file-${Date.now()}`,
      kind: "file",
      title: cleanName || "Uploaded Video",
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
      url: objectUrl,
      file,
      waveform,
      audioPeaks: peaks,
      transcript: transcriptHint,
      summary: `${meta.width}×${meta.height} local video loaded. Click "Find Clips with AI" to detect peak moments.`,
      detectedLanguage: "Auto",
    };

    const starterEnd = Math.min(meta.duration, Math.max(5, Math.min(20, meta.duration)));
    const starterClip: ClipItem = {
      id: `manual-${Date.now()}`,
      title: `${cleanName} — Opening Cut`,
      hook: "Click Find Clips with AI to generate viral hooks and captions.",
      reason: "Starter timeline selection covering the opening segment.",
      category: "Draft Cut",
      hookStrength: "Manual Cut",
      startTime: 0,
      endTime: Number(starterEnd.toFixed(2)),
      focusX: 50,
      zoom: 1,
      description: cleanName,
      hashtags: ["shorts", "reels", "clips"],
      captions: [],
    };

    setSource(nextSource);
    setClips([starterClip]);
    setActiveClipId(starterClip.id);
    currentTimeRef.current = 0;
    setCurrentTime(0);

    // Automatically run Gemini AI clip finder on newly uploaded videos
    void runAiClipAnalysis(nextSource, 3, "YouTube Shorts");
  };

  const handleLoadSample = (sample: SampleSessionPreset) => {
    setIsPlaying(false);
    setAnalysisError(null);
    setExportError(null);
    setPolishError(null);

    const nextSource = createVideoSourceFromSample(sample);
    const clonedClips = structuredClone(sample.starterClips);
    setSource(nextSource);
    setClips(clonedClips);
    setActiveClipId(clonedClips[0]?.id ?? null);
    const startT = clonedClips[0]?.startTime ?? 0;
    currentTimeRef.current = startT;
    setCurrentTime(startT);
  };

  const runAiClipAnalysis = async (
    targetSource: VideoSource,
    clipCount: number,
    platform: TargetPlatform
  ) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisStage("Preparing video frames & audio peaks...");

    try {
      let response: Response;

      if (
        targetSource.kind === "file" &&
        targetSource.file &&
        targetSource.file.size <= 14 * 1024 * 1024
      ) {
        setAnalysisStage("Sending video directly to Gemini for multimodal analysis...");
        const formData = new FormData();
        formData.append("video", targetSource.file);
        formData.append("duration", String(targetSource.duration));
        formData.append("videoTitle", targetSource.title);
        formData.append("transcript", targetSource.transcript);
        formData.append("clipCount", String(clipCount));
        formData.append("platform", platform);
        formData.append("audioPeaks", JSON.stringify(targetSource.audioPeaks));

        response = await fetch("/api/analyze-video", {
          method: "POST",
          body: formData,
        });
      } else {
        let frames: Array<{ timestamp: number; dataUrl: string }> = [];
        if (targetSource.kind === "file" && targetSource.url) {
          setAnalysisStage("Sampling video keyframes across timeline...");
          frames = await sampleKeyframesFromVideo(
            targetSource.url,
            targetSource.duration,
            8
          );
        } else if (targetSource.kind === "sample" && targetSource.sampleImage) {
          const dataUrl = await imageUrlToDataUrl(targetSource.sampleImage);
          if (dataUrl) {
            frames = [
              { timestamp: Number((targetSource.duration * 0.25).toFixed(1)), dataUrl },
              { timestamp: Number((targetSource.duration * 0.7).toFixed(1)), dataUrl },
            ];
          }
        }

        setAnalysisStage("Detecting viral hooks, crop focus, and timed captions...");
        response = await fetch("/api/analyze-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            frames,
            duration: targetSource.duration,
            videoTitle: targetSource.title,
            transcript: targetSource.transcript,
            audioPeaks: targetSource.audioPeaks,
            clipCount,
            platform,
          }),
        });
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Video analysis failed.");
      }

      if (!Array.isArray(data.clips) || data.clips.length === 0) {
        throw new Error("No clips were returned. Try adjusting clip count or adding notes.");
      }

      setClips(data.clips);
      setActiveClipId(data.clips[0].id);
      setSource((prev) => ({
        ...prev,
        summary: data.summary || prev.summary,
        detectedLanguage: data.detectedLanguage || prev.detectedLanguage,
      }));
      handleSeek(data.clips[0].startTime);
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : "Could not analyze video."
      );
    } finally {
      setIsAnalyzing(false);
      setAnalysisStage("");
    }
  };

  const handleSelectClip = (id: string) => {
    const found = clips.find((c) => c.id === id);
    setActiveClipId(id);
    if (found) {
      handleSeek(found.startTime);
    }
  };

  const handleAddManualClip = () => {
    const start = Math.max(0, Math.min(source.duration - 4, currentTime));
    const end = Math.min(source.duration, start + 12);
    const next: ClipItem = {
      id: `clip-${Date.now()}`,
      title: `Manual Cut ${clips.length + 1}`,
      hook: "Edit hook or run AI Rewrite in the inspector.",
      reason: "Custom timeline cut added manually.",
      category: "Manual Cut",
      hookStrength: "Custom",
      startTime: Number(start.toFixed(2)),
      endTime: Number(end.toFixed(2)),
      focusX: 50,
      zoom: 1,
      description: source.title,
      hashtags: ["shorts", "video"],
      captions: [
        {
          id: `cap-${Date.now()}`,
          startTime: Number(start.toFixed(2)),
          endTime: Number(Math.min(end, start + 3).toFixed(2)),
          text: "Add your opening line here",
          highlightWord: "opening",
        },
      ],
    };
    setClips((prev) => [next, ...prev]);
    setActiveClipId(next.id);
    handleSeek(next.startTime);
  };

  const handleDuplicateClip = (id: string) => {
    const orig = clips.find((c) => c.id === id);
    if (!orig) return;
    const copy: ClipItem = {
      ...structuredClone(orig),
      id: `clip-dup-${Date.now()}`,
      title: `${orig.title} (Copy)`,
    };
    setClips((prev) => [copy, ...prev]);
    setActiveClipId(copy.id);
  };

  const handleDeleteClip = (id: string) => {
    setClips((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (activeClipId === id) {
        setActiveClipId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const handleUpdateActiveClip = (patch: Partial<ClipItem>) => {
    if (!activeClipId) return;
    setClips((prev) =>
      prev.map((c) => (c.id === activeClipId ? { ...c, ...patch } : c))
    );
  };

  const handleTrimActiveClip = (startTime: number, endTime: number) => {
    handleUpdateActiveClip({
      startTime: Number(startTime.toFixed(2)),
      endTime: Number(endTime.toFixed(2)),
    });
  };

  const handlePolishClip = async (platform: TargetPlatform, tone: string) => {
    if (!activeClip) return;
    setIsPolishing(true);
    setPolishError(null);
    try {
      const res = await fetch("/api/polish-clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: activeClip.title,
          hook: activeClip.hook,
          description: activeClip.description,
          captions: activeClip.captions,
          platform,
          tone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not rewrite clip package.");
      }
      handleUpdateActiveClip({
        title: data.title,
        hook: data.hook,
        description: data.description,
        hashtags: data.hashtags,
        captions: data.captions,
      });
    } catch (err) {
      setPolishError(
        err instanceof Error ? err.message : "Failed to polish clip."
      );
    } finally {
      setIsPolishing(false);
    }
  };

  const handleExportVideo = async () => {
    if (!activeClip) return;
    setIsPlaying(false);
    if (hiddenVideoRef.current) hiddenVideoRef.current.pause();

    setIsExporting(true);
    setExportProgress(0);
    setExportError(null);

    const controller = new AbortController();
    exportAbortRef.current = controller;

    try {
      const blob = await renderAndExportClipWebm({
        sourceKind: source.kind,
        videoUrl: source.url,
        sampleImage: sampleImageElRef.current,
        startTime: activeClip.startTime,
        endTime: activeClip.endTime,
        aspectRatio,
        fitMode,
        focusX: activeClip.focusX,
        zoom: activeClip.zoom,
        captions: activeClip.captions,
        captionStyle,
        onProgress: setExportProgress,
        signal: controller.signal,
      });

      if (lastExportUrl) URL.revokeObjectURL(lastExportUrl);
      const url = URL.createObjectURL(blob);
      const slug =
        activeClip.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 42) || "peakcut-clip";
      const fileName = `${slug}-${aspectRatio.replace(":", "x")}.webm`;

      setLastExportUrl(url);
      setLastExportName(fileName);

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed.";
      if (msg !== "Export cancelled.") {
        setExportError(msg);
      }
    } finally {
      setIsExporting(false);
      exportAbortRef.current = null;
    }
  };

  const handleCancelExport = () => {
    exportAbortRef.current?.abort();
  };

  const handleDownloadSrt = () => {
    if (!activeClip) return;
    const srt = generateSrtContent(activeClip.captions, activeClip.startTime);
    const blob = new Blob([srt || "1\n00:00:00,000 --> 00:00:02,000\n\n"], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const slug =
      activeClip.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 42) || "peakcut-subtitles";
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.srt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setIsWindowDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsWindowDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsWindowDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith("video/")) {
          void handleLoadLocalFile(file);
        }
      }}
      className="h-screen w-screen overflow-hidden bg-[#0B0D11] text-[#F1F3F6] flex flex-col"
    >
      {/* Hidden native video decoder for uploaded/recorded files */}
      <video
        ref={hiddenVideoRef}
        src={source.kind === "file" ? source.url : undefined}
        playsInline
        preload="auto"
        className="hidden"
      />

      <TopBar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onOpenSourceModal={() => setIsSourceModalOpen(true)}
      />

      {/* Mobile compact view switcher (visible only on small screens) */}
      <div className="sm:hidden flex items-center gap-1 p-2 border-b border-white/[0.08] bg-[#10131A]">
        {(
          [
            { id: "studio", label: "Studio" },
            { id: "clips", label: "Clips" },
            { id: "captions", label: "Captions" },
            { id: "export", label: "Export" },
          ] as Array<{ id: WorkspaceTab; label: string }>
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleSelectTab(item.id)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md ${
              activeTab === item.id
                ? "bg-[#1C222E] text-white"
                : "text-[#9097A6]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Main 3-column Pro NLE Workspace */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        {/* Left: AI Clips Queue */}
        <div
          className={`${
            activeTab === "clips" ? "flex" : "hidden lg:flex"
          } min-h-0 flex-col`}
        >
          <ClipListPanel
            clips={clips}
            activeClipId={activeClipId}
            onSelectClip={handleSelectClip}
            onAddManualClip={handleAddManualClip}
            onDuplicateClip={handleDuplicateClip}
            onDeleteClip={handleDeleteClip}
            onRunAiAnalysis={(count, platform) =>
              void runAiClipAnalysis(source, count, platform)
            }
            isAnalyzing={isAnalyzing}
            analysisStage={analysisStage}
            analysisError={analysisError}
            sourceTitle={source.title}
            sourceDuration={source.duration}
            sourceSummary={source.summary}
          />
        </div>

        {/* Center: Vertical Monitor + Docked Timeline */}
        <div
          className={`${
            activeTab === "studio" ? "flex" : "hidden lg:flex"
          } flex-1 min-w-0 min-h-0 flex-col`}
        >
          <VideoStage
            canvasRef={previewCanvasRef}
            aspectRatio={aspectRatio}
            fitMode={fitMode}
            focusX={activeClip?.focusX ?? 50}
            zoom={activeClip?.zoom ?? 1}
            isPlaying={isPlaying}
            sourceKind={source.kind}
            activeClipTitle={activeClip?.title ?? null}
            onTogglePlay={handleTogglePlay}
            onChangeFocusX={(fx) => handleUpdateActiveClip({ focusX: fx })}
            onOpenSourceModal={() => setIsSourceModalOpen(true)}
          />

          <Timeline
            duration={source.duration}
            currentTime={currentTime}
            isPlaying={isPlaying}
            loopClip={loopClip}
            playbackRate={playbackRate}
            isMuted={isMuted}
            hasRealAudio={source.kind === "file"}
            waveform={source.waveform}
            clips={clips}
            activeClip={activeClip}
            onSeek={handleSeek}
            onTogglePlay={handleTogglePlay}
            onToggleLoop={() => setLoopClip((v) => !v)}
            onChangeSpeed={setPlaybackRate}
            onToggleMute={() => setIsMuted((v) => !v)}
            onSelectClip={handleSelectClip}
            onTrimActiveClip={handleTrimActiveClip}
          />
        </div>

        {/* Right: Framing, Captions & Export Inspector */}
        <div
          className={`${
            activeTab === "captions" || activeTab === "export"
              ? "flex"
              : "hidden lg:flex"
          } min-h-0 flex-col`}
        >
          <InspectorPanel
            section={inspectorSection}
            onChangeSection={(sec) => {
              setInspectorSection(sec);
              if (sec === "captions") setActiveTab("captions");
              else if (sec === "export") setActiveTab("export");
              else setActiveTab("studio");
            }}
            activeClip={activeClip}
            currentTime={currentTime}
            aspectRatio={aspectRatio}
            fitMode={fitMode}
            captionStyle={captionStyle}
            onChangeAspectRatio={setAspectRatio}
            onChangeFitMode={setFitMode}
            onChangeCaptionStyle={setCaptionStyle}
            onUpdateClip={handleUpdateActiveClip}
            onSeek={handleSeek}
            onPolishClip={handlePolishClip}
            isPolishing={isPolishing}
            polishError={polishError}
            onExportVideo={() => void handleExportVideo()}
            onCancelExport={handleCancelExport}
            isExporting={isExporting}
            exportProgress={exportProgress}
            exportError={exportError}
            lastExportUrl={lastExportUrl}
            lastExportName={lastExportName}
            onDownloadSrt={handleDownloadSrt}
          />
        </div>
      </div>

      <SourceModal
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        onSelectFile={(file, hint) => void handleLoadLocalFile(file, hint)}
        onSelectSample={handleLoadSample}
      />

      {/* Full-window drag-and-drop overlay */}
      {isWindowDragging && (
        <div className="fixed inset-0 z-50 bg-[#0B0D11]/85 backdrop-blur-sm border-2 border-dashed border-[#E5484D] m-3 rounded-2xl flex flex-col items-center justify-center pointer-events-none">
          <Upload className="w-8 h-8 text-[#E5484D] mb-2" />
          <p className="font-display text-lg font-semibold text-white">
            Drop video to open in PeakCut Studio
          </p>
          <p className="text-xs text-[#9097A6] mt-1">
            MP4, WebM, or MOV — AI clip detection starts automatically
          </p>
        </div>
      )}
    </div>
  );
}
