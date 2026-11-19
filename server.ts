import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = "gemini-4-hydrogen";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 16 * 1024 * 1024, // 16MB direct inline video cap; larger videos use sampled keyframes
  },
});

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error(
      "GEMINI_API_KEY is not configured. Add your key in Settings > Secrets."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function formatApiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("GEMINI_API_KEY")) {
    return { status: 500, message: raw };
  }
  if (raw.includes("403") || raw.includes("PERMISSION_DENIED") || raw.includes("API_KEY_INVALID")) {
    return {
      status: 403,
      message: "Gemini API key was rejected. Verify your key in Settings > Secrets.",
    };
  }
  if (raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message: "Gemini API quota reached. Wait a moment or check your billing tier in Settings > Secrets.",
    };
  }
  if (raw.includes("404") || raw.includes("NOT_FOUND")) {
    return {
      status: 404,
      message: `Model ${MODEL_NAME} returned not found. Please retry shortly.`,
    };
  }
  return {
    status: 500,
    message: raw || "Unexpected error while analyzing video with Gemini.",
  };
}

interface KeyframeInput {
  timestamp: number;
  dataUrl: string;
}

const analyzeResponseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "Concise 1-2 sentence overview of the source video.",
    },
    detectedLanguage: {
      type: Type.STRING,
      description: "Primary language detected in the video or transcript (e.g., English, Hindi).",
    },
    clips: {
      type: Type.ARRAY,
      description: "Ranked list of high-retention vertical clip moments.",
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "Crisp, curiosity-driven short clip title (max 65 characters).",
          },
          hook: {
            type: Type.STRING,
            description: "Opening 2-second spoken or on-screen hook line.",
          },
          reason: {
            type: Type.STRING,
            description: "Concrete editorial explanation of why this moment retains viewers.",
          },
          category: {
            type: Type.STRING,
            description: "Topic label such as Storytelling, Insight, Demo, Hot Take, or Tutorial.",
          },
          hookStrength: {
            type: Type.STRING,
            description: "One of: Strong Hook, High Retention, Emotional Peak, Key Takeaway.",
          },
          startTime: {
            type: Type.NUMBER,
            description: "Clip start time in seconds within the source video duration.",
          },
          endTime: {
            type: Type.NUMBER,
            description: "Clip end time in seconds, strictly greater than startTime and within video duration.",
          },
          focusX: {
            type: Type.NUMBER,
            description: "Recommended horizontal crop center from 15 to 85 (50 = dead center) for 9:16 vertical reframing.",
          },
          description: {
            type: Type.STRING,
            description: "Ready-to-post social caption for YouTube Shorts, Reels, or TikTok.",
          },
          hashtags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3 to 5 relevant hashtags without leading #.",
          },
          captions: {
            type: Type.ARRAY,
            description: "Sequential timed subtitle cues spanning startTime to endTime (2 to 6 words per cue).",
            items: {
              type: Type.OBJECT,
              properties: {
                startTime: { type: Type.NUMBER },
                endTime: { type: Type.NUMBER },
                text: { type: Type.STRING },
                highlightWord: {
                  type: Type.STRING,
                  description: "Single punchiest word from text to emphasize visually.",
                },
              },
              required: ["startTime", "endTime", "text", "highlightWord"],
            },
          },
        },
        required: [
          "title",
          "hook",
          "reason",
          "category",
          "hookStrength",
          "startTime",
          "endTime",
          "focusX",
          "description",
          "hashtags",
          "captions",
        ],
      },
    },
  },
  required: ["summary", "detectedLanguage", "clips"],
};

const polishResponseSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    hook: { type: Type.STRING },
    description: { type: Type.STRING },
    hashtags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    captions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          startTime: { type: Type.NUMBER },
          endTime: { type: Type.NUMBER },
          text: { type: Type.STRING },
          highlightWord: { type: Type.STRING },
        },
        required: ["startTime", "endTime", "text", "highlightWord"],
      },
    },
  },
  required: ["title", "hook", "description", "hashtags", "captions"],
};

async function createApp() {
  const app = express();
  app.use(express.json({ limit: "25mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // Analyze uploaded video directly (multipart) OR sampled frames + transcript (JSON)
  app.post("/api/analyze-video", upload.single("video"), async (req, res) => {
    try {
      const ai = getAiClient();
      const body = req.body ?? {};
      const duration = Math.max(5, Number(body.duration || 45));
      const videoTitle = String(body.videoTitle || "Untitled Studio Recording").slice(0, 140);
      const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
      const clipCount = Math.min(6, Math.max(2, Number(body.clipCount || 3)));
      const targetLength = String(body.targetLength || "15-35s");
      const platform = String(body.platform || "YouTube Shorts");
      const audioPeaksRaw = body.audioPeaks;
      let audioPeaks: number[] = [];
      if (Array.isArray(audioPeaksRaw)) {
        audioPeaks = audioPeaksRaw.map(Number).filter((n) => Number.isFinite(n));
      } else if (typeof audioPeaksRaw === "string" && audioPeaksRaw.trim()) {
        try {
          const parsed = JSON.parse(audioPeaksRaw);
          if (Array.isArray(parsed)) {
            audioPeaks = parsed.map(Number).filter((n) => Number.isFinite(n));
          }
        } catch {
          audioPeaks = [];
        }
      }

      const parts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      > = [];

      if (req.file && req.file.buffer.length > 0) {
        parts.push({
          inlineData: {
            mimeType: req.file.mimetype || "video/mp4",
            data: req.file.buffer.toString("base64"),
          },
        });
      } else if (Array.isArray(body.frames) && body.frames.length > 0) {
        const frames = (body.frames as KeyframeInput[]).slice(0, 12);
        for (const frame of frames) {
          const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(
            frame.dataUrl || ""
          );
          if (match) {
            parts.push({
              text: `Frame at ${Number(frame.timestamp || 0).toFixed(1)}s:`,
            });
            parts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2],
              },
            });
          }
        }
      }

      const promptLines = [
        `You are a senior short-form video editor turning a long-form video into high-retention vertical clips for ${platform}.`,
        `Video title: "${videoTitle}"`,
        `Total duration: ${duration.toFixed(1)} seconds (valid timestamp range: 0.0 to ${duration.toFixed(1)}).`,
        `Requested clips: ${clipCount} distinct non-overlapping (or minimally overlapping) moments, ideally ${targetLength} each (or scaled proportionally if total video is shorter than 30s).`,
        audioPeaks.length > 0
          ? `Detected audio energy peak timestamps (seconds): ${audioPeaks.map((t) => t.toFixed(1)).join(", ")}.`
          : "",
        transcript
          ? `Transcript / speaker context:\n${transcript}`
          : "No written transcript was provided — rely directly on the video audio and/or visual frames to craft accurate timed captions and hooks.",
        `Rules:`,
        `1. Every clip startTime and endTime MUST be inside [0, ${duration.toFixed(1)}] with endTime - startTime >= 4 seconds.`,
        `2. For each clip, produce tight sequential captions covering the clip window (2 to 6 words per caption line, matching actual dialogue or clear scene narration).`,
        `3. Set focusX (15-85) based on where the main speaker or subject sits horizontally in the frame so 9:16 vertical cropping frames them cleanly.`,
        `4. Use natural, concrete editorial phrasing without hype cliches.`,
      ].filter(Boolean);

      parts.push({ text: promptLines.join("\n") });

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts },
        config: {
          systemInstruction:
            "You are an expert short-form video editor specializing in viral vertical clip extraction, framing, and kinetic captioning. Always return strictly valid JSON matching the requested schema.",
          responseMimeType: "application/json",
          responseSchema: analyzeResponseSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const rawText = (response.text ?? "{}").trim();
      const parsed = JSON.parse(rawText);

      const safeClips = Array.isArray(parsed.clips)
        ? parsed.clips.map((clip: Record<string, unknown>, idx: number) => {
            const rawStart = Math.max(0, Math.min(duration - 3, Number(clip.startTime ?? 0)));
            const rawEnd = Math.max(
              rawStart + 3,
              Math.min(duration, Number(clip.endTime ?? rawStart + 12))
            );
            const rawCaptions = Array.isArray(clip.captions) ? clip.captions : [];
            const normalizedCaptions = rawCaptions.map(
              (c: Record<string, unknown>, cIdx: number) => {
                const cStart = Math.max(
                  rawStart,
                  Math.min(rawEnd - 0.5, Number(c.startTime ?? rawStart + cIdx * 2))
                );
                const cEnd = Math.max(
                  cStart + 0.5,
                  Math.min(rawEnd, Number(c.endTime ?? cStart + 2.2))
                );
                return {
                  id: `cap-${Date.now()}-${idx}-${cIdx}`,
                  startTime: Number(cStart.toFixed(2)),
                  endTime: Number(cEnd.toFixed(2)),
                  text: String(c.text || "").trim(),
                  highlightWord: String(c.highlightWord || "").trim(),
                };
              }
            );

            return {
              id: `clip-${Date.now()}-${idx}`,
              title: String(clip.title || `Highlight Clip ${idx + 1}`).trim(),
              hook: String(clip.hook || "").trim(),
              reason: String(clip.reason || "").trim(),
              category: String(clip.category || "Highlight").trim(),
              hookStrength: String(clip.hookStrength || "Strong Hook").trim(),
              startTime: Number(rawStart.toFixed(2)),
              endTime: Number(rawEnd.toFixed(2)),
              focusX: Math.max(10, Math.min(90, Math.round(Number(clip.focusX ?? 50)))),
              zoom: 1,
              description: String(clip.description || "").trim(),
              hashtags: Array.isArray(clip.hashtags)
                ? clip.hashtags
                    .map((h: unknown) => String(h).replace(/^#/, "").trim())
                    .filter(Boolean)
                    .slice(0, 6)
                : [],
              captions: normalizedCaptions,
            };
          })
        : [];

      res.json({
        summary: String(parsed.summary || ""),
        detectedLanguage: String(parsed.detectedLanguage || "English"),
        clips: safeClips,
      });
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  // Polish hook, title, social copy, and caption punchiness for a specific clip
  app.post("/api/polish-clip", async (req, res) => {
    try {
      const ai = getAiClient();
      const { title, hook, description, captions, platform, tone } = req.body ?? {};

      const prompt = [
        `Rewrite and sharpen this vertical video clip package for ${platform || "YouTube Shorts"} in a "${tone || "Direct & Punchy"}" editorial tone.`,
        `Current title: ${title || ""}`,
        `Current hook: ${hook || ""}`,
        `Current description: ${description || ""}`,
        `Current timed captions (preserve exact startTime and endTime values, tighten wording to 2-6 punchy words per cue, and choose one highlightWord per cue):`,
        JSON.stringify(captions || []),
      ].join("\n\n");

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            "You are a sharp short-form video producer. Rewrite titles, hooks, social copy, and tight timed captions while strictly preserving every caption cue's startTime and endTime.",
          responseMimeType: "application/json",
          responseSchema: polishResponseSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const rawText = (response.text ?? "{}").trim();
      const parsed = JSON.parse(rawText);

      res.json({
        title: String(parsed.title || title || ""),
        hook: String(parsed.hook || hook || ""),
        description: String(parsed.description || description || ""),
        hashtags: Array.isArray(parsed.hashtags)
          ? parsed.hashtags
              .map((h: unknown) => String(h).replace(/^#/, "").trim())
              .filter(Boolean)
          : [],
        captions: Array.isArray(parsed.captions)
          ? parsed.captions.map((c: Record<string, unknown>, idx: number) => ({
              id: `cap-pol-${Date.now()}-${idx}`,
              startTime: Number(c.startTime ?? 0),
              endTime: Number(c.endTime ?? 2),
              text: String(c.text || "").trim(),
              highlightWord: String(c.highlightWord || "").trim(),
            }))
          : captions || [],
      });
    } catch (err) {
      const { status, message } = formatApiError(err);
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("/{*splat}", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PeakCut Studio server running on http://0.0.0.0:${PORT}`);
  });
}

createApp();
