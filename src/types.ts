export type AspectRatio = "9:16" | "1:1" | "16:9";
export type FitMode = "crop" | "blur-fit";
export type CaptionPreset = "kinetic" | "studio" | "highlight-box" | "cinema";
export type CaptionPosition = "bottom" | "center" | "top";
export type WorkspaceTab = "studio" | "clips" | "captions" | "export";
export type TargetPlatform = "YouTube Shorts" | "Instagram Reels" | "TikTok";

export interface CaptionSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  highlightWord: string;
}

export interface ClipItem {
  id: string;
  title: string;
  hook: string;
  reason: string;
  category: string;
  hookStrength: string;
  startTime: number;
  endTime: number;
  focusX: number; // 0-100 horizontal crop center
  zoom: number; // 1.0 - 2.0
  description: string;
  hashtags: string[];
  captions: CaptionSegment[];
}

export interface CaptionStyleConfig {
  enabled: boolean;
  preset: CaptionPreset;
  position: CaptionPosition;
  fontSize: number; // 28 - 64 logical canvas px
  accentColor: string;
  uppercase: boolean;
}

export interface VideoSource {
  id: string;
  kind: "file" | "sample";
  title: string;
  duration: number;
  width: number;
  height: number;
  url?: string; // ObjectURL for uploaded/recorded files
  file?: File;
  sampleImage?: string; // Generated studio image for instant sample sessions
  waveform: number[]; // Normalized 0..1 amplitude peaks
  audioPeaks: number[]; // Peak timestamps in seconds
  transcript: string;
  summary: string;
  detectedLanguage: string;
}

export interface SampleSessionPreset {
  id: string;
  title: string;
  creator: string;
  category: string;
  duration: number;
  image: string;
  summary: string;
  transcript: string;
  waveform: number[];
  audioPeaks: number[];
  starterClips: ClipItem[];
}
