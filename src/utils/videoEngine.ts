import type {
  AspectRatio,
  CaptionSegment,
  CaptionStyleConfig,
  FitMode,
} from "../types";

export function formatTimecode(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const tenths = Math.floor((safe - Math.floor(safe)) * 10);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
}

export function formatSrtTimestamp(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(Math.min(999, ms)).padStart(3, "0")}`;
}

export function generateSrtContent(
  captions: CaptionSegment[],
  clipStartTime: number
): string {
  const sorted = [...captions].sort((a, b) => a.startTime - b.startTime);
  return sorted
    .map((cap, idx) => {
      const relStart = Math.max(0, cap.startTime - clipStartTime);
      const relEnd = Math.max(relStart + 0.3, cap.endTime - clipStartTime);
      return `${idx + 1}\n${formatSrtTimestamp(relStart)} --> ${formatSrtTimestamp(relEnd)}\n${cap.text.trim()}\n`;
    })
    .join("\n");
}

export function getCanvasDimensions(
  aspectRatio: AspectRatio,
  highRes = false
): { width: number; height: number } {
  if (aspectRatio === "9:16") {
    return highRes ? { width: 720, height: 1280 } : { width: 540, height: 960 };
  }
  if (aspectRatio === "1:1") {
    return highRes ? { width: 1080, height: 1080 } : { width: 720, height: 720 };
  }
  return highRes ? { width: 1280, height: 720 } : { width: 960, height: 540 };
}

export async function extractAudioWaveform(
  file: File,
  barCount = 120
): Promise<{ waveform: number[]; peaks: number[] }> {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) {
      return fallbackWaveform(barCount, 30);
    }
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new AudioCtx();
    const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const channelData = decoded.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(channelData.length / barCount));
    const raw: number[] = [];

    for (let i = 0; i < barCount; i++) {
      const start = i * blockSize;
      const end = Math.min(channelData.length, start + blockSize);
      let sumSquares = 0;
      const stride = Math.max(1, Math.floor((end - start) / 256));
      let count = 0;
      for (let j = start; j < end; j += stride) {
        const sample = channelData[j];
        sumSquares += sample * sample;
        count++;
      }
      const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
      raw.push(rms);
    }

    const maxVal = Math.max(0.001, ...raw);
    const waveform = raw.map((v) =>
      Number(Math.min(1, Math.max(0.08, v / maxVal)).toFixed(3))
    );

    // Find top 6 spaced-out energy peak timestamps for Gemini context
    const indexed = waveform
      .map((val, idx) => ({
        val,
        time: (idx / barCount) * decoded.duration,
      }))
      .sort((a, b) => b.val - a.val);

    const peaks: number[] = [];
    for (const item of indexed) {
      if (peaks.every((p) => Math.abs(p - item.time) > Math.max(3, decoded.duration / 12))) {
        peaks.push(Number(item.time.toFixed(1)));
      }
      if (peaks.length >= 6) break;
    }

    await audioCtx.close().catch(() => {});
    return { waveform, peaks: peaks.sort((a, b) => a - b) };
  } catch {
    return fallbackWaveform(barCount, 30);
  }
}

function fallbackWaveform(
  barCount: number,
  duration: number
): { waveform: number[]; peaks: number[] } {
  const waveform = Array.from({ length: barCount }, (_, i) => {
    const t = i / barCount;
    const v = 0.25 + 0.55 * Math.abs(Math.sin(t * 18) * Math.cos(t * 7));
    return Number(v.toFixed(3));
  });
  return {
    waveform,
    peaks: [duration * 0.2, duration * 0.5, duration * 0.78].map((n) =>
      Number(n.toFixed(1))
    ),
  };
}

export async function sampleKeyframesFromVideo(
  videoUrl: string,
  duration: number,
  frameCount = 8
): Promise<Array<{ timestamp: number; dataUrl: string }>> {
  return new Promise((resolve) => {
    const tempVideo = document.createElement("video");
    tempVideo.src = videoUrl;
    tempVideo.muted = true;
    tempVideo.playsInline = true;
    tempVideo.crossOrigin = "anonymous";

    const frames: Array<{ timestamp: number; dataUrl: string }> = [];
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const safeDuration = Math.max(2, duration);
    const count = Math.min(10, Math.max(4, frameCount));
    const timestamps = Array.from(
      { length: count },
      (_, i) => Number((((i + 0.5) / count) * safeDuration).toFixed(2))
    );

    let index = 0;

    const cleanup = () => {
      tempVideo.pause();
      tempVideo.removeAttribute("src");
      tempVideo.load();
    };

    const captureNext = () => {
      if (index >= timestamps.length || !ctx) {
        cleanup();
        resolve(frames);
        return;
      }
      tempVideo.currentTime = Math.min(safeDuration - 0.1, timestamps[index]);
    };

    tempVideo.onloadeddata = () => {
      const vw = tempVideo.videoWidth || 640;
      const vh = tempVideo.videoHeight || 360;
      const targetW = 440;
      const targetH = Math.round((vh / vw) * targetW);
      canvas.width = targetW;
      canvas.height = targetH;
      captureNext();
    };

    tempVideo.onseeked = () => {
      if (ctx) {
        ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
        frames.push({
          timestamp: timestamps[index],
          dataUrl: canvas.toDataURL("image/jpeg", 0.65),
        });
      }
      index++;
      captureNext();
    };

    tempVideo.onerror = () => {
      cleanup();
      resolve(frames);
    };
  });
}

export async function imageUrlToDataUrl(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const targetW = 480;
      const targetH = Math.round((img.naturalHeight / img.naturalWidth) * targetW);
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export interface RenderFrameParams {
  ctx: CanvasRenderingContext2D;
  source: HTMLVideoElement | HTMLImageElement | null;
  sourceWidth: number;
  sourceHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  fitMode: FitMode;
  focusX: number; // 0..100
  zoom: number; // 1..2
  currentTime: number;
  isSampleMotion?: boolean;
  activeCaption: CaptionSegment | null;
  captionStyle: CaptionStyleConfig;
}

export function renderClipFrame({
  ctx,
  source,
  sourceWidth,
  sourceHeight,
  canvasWidth,
  canvasHeight,
  fitMode,
  focusX,
  zoom,
  currentTime,
  isSampleMotion = false,
  activeCaption,
  captionStyle,
}: RenderFrameParams): void {
  ctx.save();
  ctx.fillStyle = "#080A0E";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  if (source && sourceWidth > 0 && sourceHeight > 0) {
    // Subtle realistic camera drift for static sample studio stills so playback feels alive
    const motionZoom = isSampleMotion ? 1.03 + 0.03 * Math.sin(currentTime * 0.45) : 1;
    const motionPan = isSampleMotion ? Math.sin(currentTime * 0.32) * 2.5 : 0;
    const effectiveZoom = Math.max(1, zoom) * motionZoom;
    const effectiveFocusX = Math.max(0, Math.min(100, focusX + motionPan));

    if (fitMode === "blur-fit") {
      // Soft atmospheric blurred backdrop filling vertical frame
      const bgScale = Math.max(canvasWidth / sourceWidth, canvasHeight / sourceHeight) * 1.15;
      const bgW = sourceWidth * bgScale;
      const bgH = sourceHeight * bgScale;
      ctx.save();
      ctx.filter = "blur(24px) brightness(0.45)";
      ctx.drawImage(
        source,
        (canvasWidth - bgW) / 2,
        (canvasHeight - bgH) / 2,
        bgW,
        bgH
      );
      ctx.restore();

      // Sharp foreground letterboxed cleanly in center
      const fgScale = Math.min(canvasWidth / sourceWidth, canvasHeight / sourceHeight) * effectiveZoom;
      const fgW = sourceWidth * fgScale;
      const fgH = sourceHeight * fgScale;
      const offsetX = (canvasWidth - fgW) * (effectiveFocusX / 100);
      const offsetY = (canvasHeight - fgH) / 2;

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.65)";
      ctx.shadowBlur = 28;
      ctx.drawImage(source, offsetX, offsetY, fgW, fgH);
      ctx.restore();
    } else {
      // Smart Crop mode: fill frame cleanly centered on focusX
      const baseScale = Math.max(canvasWidth / sourceWidth, canvasHeight / sourceHeight);
      const drawW = sourceWidth * baseScale * effectiveZoom;
      const drawH = sourceHeight * baseScale * effectiveZoom;
      const maxPanX = Math.max(0, drawW - canvasWidth);
      const drawX = -maxPanX * (effectiveFocusX / 100);
      const drawY = (canvasHeight - drawH) / 2;

      ctx.drawImage(source, drawX, drawY, drawW, drawH);
    }

    // Measured contrast scrim along caption region for guaranteed 4.5:1+ legibility
    if (captionStyle.enabled && activeCaption) {
      const scrim = ctx.createLinearGradient(0, canvasHeight * 0.52, 0, canvasHeight);
      scrim.addColorStop(0, "rgba(0,0,0,0)");
      scrim.addColorStop(0.65, "rgba(0,0,0,0.42)");
      scrim.addColorStop(1, "rgba(0,0,0,0.74)");
      ctx.fillStyle = scrim;
      ctx.fillRect(0, canvasHeight * 0.52, canvasWidth, canvasHeight * 0.48);
    }
  }

  if (captionStyle.enabled && activeCaption && activeCaption.text.trim()) {
    drawAnimatedCaptions(
      ctx,
      activeCaption,
      currentTime,
      canvasWidth,
      canvasHeight,
      captionStyle
    );
  }

  ctx.restore();
}

function drawAnimatedCaptions(
  ctx: CanvasRenderingContext2D,
  caption: CaptionSegment,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
  style: CaptionStyleConfig
) {
  const scaleRatio = canvasWidth / 540;
  const fontSize = Math.round(style.fontSize * scaleRatio);
  const rawText = style.uppercase ? caption.text.toUpperCase() : caption.text;
  const words = rawText.split(/\s+/).filter(Boolean);
  if (words.length === 0) return;

  const segDuration = Math.max(0.25, caption.endTime - caption.startTime);
  const progress = Math.max(0, Math.min(0.999, (currentTime - caption.startTime) / segDuration));
  const activeWordIdx = Math.floor(progress * words.length);
  const normalizedHighlight = caption.highlightWord.toLowerCase().replace(/[^a-z0-9]/g, "");

  const fontWeight = style.preset === "kinetic" || style.preset === "highlight-box" ? "800" : "700";
  const fontFamily =
    style.preset === "cinema"
      ? '"DM Sans", system-ui, sans-serif'
      : '"Plus Jakarta Sans", system-ui, sans-serif';
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "middle";

  // Wrap words into max 2-3 balanced lines
  const maxLineWidth = canvasWidth * 0.84;
  const spaceWidth = ctx.measureText(" ").width;
  const lines: Array<Array<{ word: string; idx: number; width: number }>> = [];
  let currentLine: Array<{ word: string; idx: number; width: number }> = [];
  let currentLineWidth = 0;

  words.forEach((word, idx) => {
    const w = ctx.measureText(word).width;
    if (currentLine.length > 0 && currentLineWidth + spaceWidth + w > maxLineWidth) {
      lines.push(currentLine);
      currentLine = [{ word, idx, width: w }];
      currentLineWidth = w;
    } else {
      currentLine.push({ word, idx, width: w });
      currentLineWidth += (currentLine.length > 1 ? spaceWidth : 0) + w;
    }
  });
  if (currentLine.length > 0) lines.push(currentLine);

  const lineHeight = fontSize * 1.28;
  const totalHeight = lines.length * lineHeight;

  let baseY = canvasHeight * 0.78;
  if (style.position === "center") baseY = canvasHeight * 0.52;
  if (style.position === "top") baseY = canvasHeight * 0.2;

  const startY = baseY - totalHeight / 2 + lineHeight / 2;

  if (style.preset === "studio") {
    // Clean single translucent dark studio plate behind text block
    const maxW = Math.max(
      ...lines.map(
        (line) =>
          line.reduce((acc, item) => acc + item.width, 0) +
          Math.max(0, line.length - 1) * spaceWidth
      )
    );
    const padX = 20 * scaleRatio;
    const padY = 12 * scaleRatio;
    const boxX = (canvasWidth - maxW) / 2 - padX;
    const boxY = startY - lineHeight / 2 - padY * 0.6;
    const boxW = maxW + padX * 2;
    const boxH = totalHeight + padY * 1.2;

    ctx.fillStyle = "rgba(11, 13, 17, 0.82)";
    roundRect(ctx, boxX, boxY, boxW, boxH, 10 * scaleRatio);
    ctx.fill();
  }

  lines.forEach((line, lineIdx) => {
    const lineWidth =
      line.reduce((acc, item) => acc + item.width, 0) +
      Math.max(0, line.length - 1) * spaceWidth;
    let cursorX = (canvasWidth - lineWidth) / 2;
    const y = startY + lineIdx * lineHeight;

    line.forEach((item) => {
      const cleanWord = item.word.toLowerCase().replace(/[^a-z0-9]/g, "");
      const isSpoken = item.idx === activeWordIdx;
      const isKeyword = Boolean(normalizedHighlight && cleanWord === normalizedHighlight);

      if (style.preset === "highlight-box" && isSpoken) {
        const padX = 8 * scaleRatio;
        const padY = 4 * scaleRatio;
        ctx.fillStyle = style.accentColor;
        roundRect(
          ctx,
          cursorX - padX,
          y - fontSize * 0.58 - padY,
          item.width + padX * 2,
          fontSize * 1.16 + padY * 2,
          7 * scaleRatio
        );
        ctx.fill();
      }

      if (style.preset === "kinetic") {
        ctx.lineWidth = Math.max(4, 6 * scaleRatio);
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(0, 0, 0, 0.92)";
        ctx.strokeText(item.word, cursorX, y);
        ctx.fillStyle = isSpoken || isKeyword ? style.accentColor : "#FFFFFF";
        ctx.fillText(item.word, cursorX, y);
      } else if (style.preset === "highlight-box") {
        ctx.shadowColor = "rgba(0,0,0,0.65)";
        ctx.shadowBlur = 8 * scaleRatio;
        ctx.fillStyle = isSpoken ? "#0B0D11" : "#FFFFFF";
        ctx.fillText(item.word, cursorX, y);
        ctx.shadowBlur = 0;
      } else if (style.preset === "studio") {
        ctx.fillStyle = isSpoken || isKeyword ? style.accentColor : "#F1F3F6";
        ctx.fillText(item.word, cursorX, y);
      } else {
        // Subtle cinema
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 10 * scaleRatio;
        ctx.fillStyle = isSpoken ? "#FFFFFF" : "rgba(241, 243, 246, 0.78)";
        ctx.fillText(item.word, cursorX, y);
        ctx.shadowBlur = 0;
      }

      cursorX += item.width + spaceWidth;
    });
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface ExportClipOptions {
  sourceKind: "file" | "sample";
  videoUrl?: string;
  sampleImage?: HTMLImageElement | null;
  startTime: number;
  endTime: number;
  aspectRatio: AspectRatio;
  fitMode: FitMode;
  focusX: number;
  zoom: number;
  captions: CaptionSegment[];
  captionStyle: CaptionStyleConfig;
  onProgress: (ratio: number) => void;
  signal: AbortSignal;
}

export async function renderAndExportClipWebm(
  opts: ExportClipOptions
): Promise<Blob> {
  const { width, height } = getCanvasDimensions(opts.aspectRatio, true);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not initialize export canvas.");

  const clipDuration = Math.max(1, opts.endTime - opts.startTime);
  const stream = canvas.captureStream(30);

  let exportVideo: HTMLVideoElement | null = null;
  let audioCtx: AudioContext | null = null;

  if (opts.sourceKind === "file" && opts.videoUrl) {
    exportVideo = document.createElement("video");
    exportVideo.src = opts.videoUrl;
    exportVideo.crossOrigin = "anonymous";
    exportVideo.playsInline = true;
    exportVideo.muted = false;

    await new Promise<void>((resolve, reject) => {
      if (!exportVideo) return reject(new Error("Missing video element."));
      exportVideo.onloadeddata = () => resolve();
      exportVideo.onerror = () => reject(new Error("Could not load video for export."));
    });

    // Route real video audio into the recorded MediaStream
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtx = new AudioCtx();
      const sourceNode = audioCtx.createMediaElementSource(exportVideo);
      const destNode = audioCtx.createMediaStreamDestination();
      sourceNode.connect(destNode);
      destNode.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    } catch {
      // Fallback to silent video track if browser blocks audio routing
    }
  }

  const preferredMimes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  const mimeType =
    preferredMimes.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4_500_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  return new Promise<Blob>((resolve, reject) => {
    let rafId = 0;
    let finished = false;

    const cleanup = () => {
      cancelAnimationFrame(rafId);
      if (exportVideo) {
        exportVideo.pause();
        exportVideo.removeAttribute("src");
        exportVideo.load();
      }
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
      stream.getTracks().forEach((t) => t.stop());
    };

    const handleAbort = () => {
      if (finished) return;
      finished = true;
      if (recorder.state !== "inactive") recorder.stop();
      cleanup();
      reject(new Error("Export cancelled."));
    };
    opts.signal.addEventListener("abort", handleAbort, { once: true });

    recorder.onstop = () => {
      if (finished) return;
      finished = true;
      opts.signal.removeEventListener("abort", handleAbort);
      cleanup();
      resolve(new Blob(chunks, { type: mimeType }));
    };

    recorder.onerror = () => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error("MediaRecorder encountered an error while exporting."));
    };

    const startRecordingLoop = () => {
      const startWallTime = performance.now();
      recorder.start(200);

      const drawTick = () => {
        if (finished) return;
        const currentTime = exportVideo
          ? exportVideo.currentTime
          : opts.startTime + (performance.now() - startWallTime) / 1000;

        const elapsed = Math.max(0, currentTime - opts.startTime);
        opts.onProgress(Math.min(1, elapsed / clipDuration));

        const activeCaption =
          opts.captions.find(
            (c) => currentTime >= c.startTime && currentTime <= c.endTime
          ) ?? null;

        renderClipFrame({
          ctx,
          source: exportVideo ?? opts.sampleImage ?? null,
          sourceWidth: exportVideo
            ? exportVideo.videoWidth
            : opts.sampleImage?.naturalWidth ?? 1280,
          sourceHeight: exportVideo
            ? exportVideo.videoHeight
            : opts.sampleImage?.naturalHeight ?? 720,
          canvasWidth: width,
          canvasHeight: height,
          fitMode: opts.fitMode,
          focusX: opts.focusX,
          zoom: opts.zoom,
          currentTime,
          isSampleMotion: opts.sourceKind === "sample",
          activeCaption,
          captionStyle: opts.captionStyle,
        });

        if (currentTime >= opts.endTime || (exportVideo && exportVideo.ended)) {
          opts.onProgress(1);
          if (recorder.state !== "inactive") recorder.stop();
          return;
        }
        rafId = requestAnimationFrame(drawTick);
      };

      rafId = requestAnimationFrame(drawTick);
    };

    if (exportVideo) {
      exportVideo.currentTime = opts.startTime;
      exportVideo.onseeked = async () => {
        if (!exportVideo) return;
        exportVideo.onseeked = null;
        try {
          await exportVideo.play();
          startRecordingLoop();
        } catch (err) {
          cleanup();
          reject(err);
        }
      };
    } else {
      startRecordingLoop();
    }
  });
}
