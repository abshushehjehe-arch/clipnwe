import { useEffect, useRef, useState } from "react";
import { Upload, Video, X, Square, Circle, Film } from "lucide-react";
import { SAMPLE_SESSIONS } from "../data/samples";
import type { SampleSessionPreset } from "../types";

interface SourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (file: File, transcriptHint: string) => void;
  onSelectSample: (sample: SampleSessionPreset) => void;
}

export function SourceModal({
  isOpen,
  onClose,
  onSelectFile,
  onSelectSample,
}: SourceModalProps) {
  const [mode, setMode] = useState<"upload" | "record" | "samples">("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [transcriptHint, setTranscriptHint] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  const stopCamera = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      stopCamera();
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || mode !== "record") {
      stopCamera();
      return;
    }
    let cancelled = false;
    setCameraError(null);

    navigator.mediaDevices
      .getUserMedia({ video: { width: 1280, height: 720 }, audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
          previewVideoRef.current.play().catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCameraError(
            "Camera or microphone permission was denied. Upload a local video file or pick a studio sample instead."
          );
        }
      });

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleFilePick = (file: File | undefined | null) => {
    if (!file) return;
    onSelectFile(file, transcriptHint.trim());
    setTranscriptHint("");
    onClose();
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsRecording(false);
      return;
    }

    if (!streamRef.current) return;
    chunksRef.current = [];
    const preferred = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    const mimeType =
      preferred.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";

    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      if (chunksRef.current.length === 0) return;
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const recordedFile = new File(
        [blob],
        `studio-recording-${Date.now()}.webm`,
        { type: mimeType }
      );
      stopCamera();
      onSelectFile(recordedFile, "");
      onClose();
    };
    recorderRef.current = recorder;
    recorder.start(250);
    setRecordingSeconds(0);
    setIsRecording(true);
    timerRef.current = window.setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-modal-title"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[#12161E] border border-white/[0.1] rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between gap-4">
          <div>
            <h2
              id="source-modal-title"
              className="font-display text-base font-semibold text-white"
            >
              Load Source Video
            </h2>
            <p className="text-xs text-[#9097A6] mt-0.5">
              Import a local recording, capture from your webcam, or open a sample session.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-[#9097A6] hover:text-white hover:bg-white/[0.06] rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode selector */}
        <div className="px-6 pt-4">
          <div className="inline-flex items-center gap-1 p-1 bg-[#0B0D11] border border-white/[0.07] rounded-lg">
            {(
              [
                { id: "upload", label: "Upload Video" },
                { id: "record", label: "Record Camera" },
                { id: "samples", label: "Sample Studio Reels" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  mode === tab.id
                    ? "bg-[#1C222E] text-white"
                    : "text-[#9097A6] hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {mode === "upload" && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped && dropped.type.startsWith("video/")) {
                    handleFilePick(dropped);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer border border-dashed rounded-xl p-10 text-center transition-colors ${
                  isDragging
                    ? "border-[#E5484D] bg-[#E5484D]/[0.07]"
                    : "border-white/[0.16] bg-[#0E1117] hover:border-white/[0.3]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/*"
                  className="hidden"
                  onChange={(e) => handleFilePick(e.target.files?.[0])}
                />
                <div className="w-11 h-11 rounded-lg bg-[#181D27] border border-white/[0.08] flex items-center justify-center mx-auto mb-3.5">
                  <Upload className="w-5 h-5 text-[#E5484D]" />
                </div>
                <p className="text-sm font-medium text-white">
                  Drop an MP4, WebM, or MOV video here, or browse files
                </p>
                <p className="text-xs text-[#9097A6] mt-1.5">
                  Videos under 15 MB are sent directly to Gemini for audio & visual analysis. Larger recordings automatically extract keyframes + audio peaks.
                </p>
              </div>

              <div>
                <label
                  htmlFor="transcript-hint"
                  className="block text-xs font-medium text-[#C2C8D6] mb-1.5"
                >
                  Optional transcript or topic notes
                </label>
                <textarea
                  id="transcript-hint"
                  rows={3}
                  value={transcriptHint}
                  onChange={(e) => setTranscriptHint(e.target.value)}
                  placeholder="Paste rough transcript, speaker names, or moments to watch for (optional — Gemini also analyzes audio & visual frames directly)."
                  className="w-full rounded-lg bg-[#0B0D11] border border-white/[0.1] px-3.5 py-2.5 text-sm text-white placeholder:text-[#666D7D] focus:outline-none focus:border-[#E5484D]"
                />
              </div>
            </div>
          )}

          {mode === "record" && (
            <div className="space-y-4">
              {cameraError ? (
                <div className="p-6 rounded-lg bg-[#0B0D11] border border-white/[0.08] text-center">
                  <Video className="w-6 h-6 text-[#9097A6] mx-auto mb-2" />
                  <p className="text-sm text-[#D5DAE5]">{cameraError}</p>
                </div>
              ) : (
                <>
                  <div className="relative aspect-video bg-[#080A0E] rounded-lg overflow-hidden border border-white/[0.08]">
                    <video
                      ref={previewVideoRef}
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    {isRecording && (
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-[#0B0D11]/85 border border-white/[0.12] text-xs font-mono tabular-nums text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#E5484D]" />
                        <span>
                          REC {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:
                          {String(recordingSeconds % 60).padStart(2, "0")}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs text-[#9097A6]">
                      Record a quick take directly in your browser, then let AI detect the sharpest vertical clips.
                    </p>
                    <button
                      type="button"
                      onClick={handleToggleRecording}
                      className={`px-4 py-2 text-xs font-semibold rounded-md flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                        isRecording
                          ? "bg-white text-[#0B0D11] hover:bg-white/90"
                          : "bg-[#E5484D] text-white hover:bg-[#D63B40]"
                      }`}
                    >
                      {isRecording ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current" />
                          Stop & Open in Studio
                        </>
                      ) : (
                        <>
                          <Circle className="w-3.5 h-3.5 fill-current" />
                          Start Recording
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {mode === "samples" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {SAMPLE_SESSIONS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => {
                    onSelectSample(sample);
                    onClose();
                  }}
                  className="group text-left rounded-lg bg-[#0E1117] border border-white/[0.08] hover:border-white/[0.24] overflow-hidden transition-colors flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5484D]"
                >
                  <div className="aspect-video w-full bg-[#181D27] overflow-hidden relative">
                    {brokenImages[sample.id] ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#181D27] to-[#0E1117] p-4 text-center">
                        <Film className="w-6 h-6 text-[#9097A6] mb-1.5" />
                        <span className="text-xs text-[#C2C8D6]">{sample.category}</span>
                      </div>
                    ) : (
                      <img
                        src={sample.image}
                        alt={sample.title}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenImages((prev) => ({ ...prev, [sample.id]: true }))
                        }
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                      />
                    )}
                  </div>
                  <div className="p-3.5 flex-1 flex flex-col justify-between gap-2">
                    <div>
                      <p className="text-xs text-[#9097A6] tabular-nums">
                        {sample.category} · {sample.duration}s · {sample.starterClips.length} cuts
                      </p>
                      <h3 className="text-sm font-semibold text-white mt-1 leading-snug">
                        {sample.title}
                      </h3>
                    </div>
                    <p className="text-xs text-[#9097A6] line-clamp-2 leading-relaxed">
                      {sample.summary}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
