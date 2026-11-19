import type { SampleSessionPreset } from "../types";

function buildStudioWaveform(seed: number, length = 120): number[] {
  const bars: number[] = [];
  for (let i = 0; i < length; i++) {
    const t = i / length;
    const waveA = Math.abs(Math.sin(t * 24 + seed * 1.7));
    const waveB = Math.abs(Math.cos(t * 9.5 + seed * 2.3));
    const phraseEnvelope = 0.35 + 0.65 * Math.abs(Math.sin(t * 5.2 + seed));
    const value = Math.min(1, Math.max(0.12, (waveA * 0.55 + waveB * 0.45) * phraseEnvelope));
    bars.push(Number(value.toFixed(3)));
  }
  return bars;
}

export const SAMPLE_SESSIONS: SampleSessionPreset[] = [
  {
    id: "sample-podcast",
    title: "Founder Podcast — Scaling Solo to 100K Users",
    creator: "Signal & Craft Ep. 42",
    category: "Podcast",
    duration: 48,
    image: "/src/assets/images/sample_podcast_studio_1795075220608.jpg",
    summary:
      "A candid studio interview breaking down why shipping a narrow tool beats building a bloated platform and how retention compounds organically.",
    transcript:
      "[00:00] Most founders think they need a ten-person team before they launch. [00:05] Honestly, our first fifty thousand users came from one tiny feature we almost cut on Friday night. [00:12] People don't share software because it has forty tabs. [00:16] They share it when it removes one painful step in thirty seconds. [00:22] When we deleted half our onboarding screens, activation jumped overnight. [00:29] Stop polishing features nobody has asked for yet. [00:34] Put the core workflow on screen one, measure where people hesitate, and cut everything else. [00:42] That single rule saved us eighteen months of runway.",
    waveform: buildStudioWaveform(1.2),
    audioPeaks: [5.4, 16.2, 23.8, 35.1, 43.0],
    starterClips: [
      {
        id: "pod-clip-1",
        title: "One tiny feature drove 50K users",
        hook: "Our first 50,000 users came from one feature we almost cut.",
        reason:
          "Opens with a concrete contrarian number and immediate stakes, then pays off with an actionable product lesson.",
        category: "Founder Insight",
        hookStrength: "Strong Hook",
        startTime: 4.5,
        endTime: 21.5,
        focusX: 58,
        zoom: 1.08,
        description:
          "Why removing friction beats adding 40 tabs. From Ep. 42 of Signal & Craft.",
        hashtags: ["startups", "productdesign", "founders", "indiehacker"],
        captions: [
          {
            id: "pc1-1",
            startTime: 4.5,
            endTime: 7.4,
            text: "Our first fifty thousand users",
            highlightWord: "fifty",
          },
          {
            id: "pc1-2",
            startTime: 7.4,
            endTime: 10.6,
            text: "came from one tiny feature",
            highlightWord: "tiny",
          },
          {
            id: "pc1-3",
            startTime: 10.6,
            endTime: 13.8,
            text: "we almost cut on Friday night.",
            highlightWord: "cut",
          },
          {
            id: "pc1-4",
            startTime: 13.8,
            endTime: 17.5,
            text: "People don't share forty tabs.",
            highlightWord: "forty",
          },
          {
            id: "pc1-5",
            startTime: 17.5,
            endTime: 21.5,
            text: "They share thirty-second relief.",
            highlightWord: "relief.",
          },
        ],
      },
      {
        id: "pod-clip-2",
        title: "Deleting onboarding doubled activation",
        hook: "When we deleted half our onboarding, activation jumped overnight.",
        reason:
          "Clear cause-and-effect takeaway paired with a memorable final runway metric.",
        category: "Growth Tactic",
        hookStrength: "High Retention",
        startTime: 22.0,
        endTime: 46.5,
        focusX: 58,
        zoom: 1.12,
        description:
          "Put the core workflow on screen one and cut everything else.",
        hashtags: ["growth", "uxdesign", "saas", "bootstrapping"],
        captions: [
          {
            id: "pc2-1",
            startTime: 22.0,
            endTime: 26.2,
            text: "We deleted half our onboarding.",
            highlightWord: "deleted",
          },
          {
            id: "pc2-2",
            startTime: 26.2,
            endTime: 29.8,
            text: "Activation jumped overnight.",
            highlightWord: "jumped",
          },
          {
            id: "pc2-3",
            startTime: 29.8,
            endTime: 34.4,
            text: "Stop polishing unrequested features.",
            highlightWord: "Stop",
          },
          {
            id: "pc2-4",
            startTime: 34.4,
            endTime: 40.8,
            text: "Put the core workflow on screen one.",
            highlightWord: "screen",
          },
          {
            id: "pc2-5",
            startTime: 40.8,
            endTime: 46.5,
            text: "That saved eighteen months of runway.",
            highlightWord: "eighteen",
          },
        ],
      },
    ],
  },
  {
    id: "sample-keynote",
    title: "Hardware Keynote — Designing Quiet Everyday Tools",
    creator: "Field Notes Live",
    category: "Keynote",
    duration: 42,
    image: "/src/assets/images/sample_tech_keynote_1795075221501.jpg",
    summary:
      "Stage demonstration of a milled aluminum audio recorder explaining why tactile switches beat nested touchscreens.",
    transcript:
      "[00:00] Every device on your desk is fighting for your attention right now. [00:06] We asked a different question: what if a tool stayed completely silent until you needed it? [00:13] One solid block of anodized aluminum. No notifications, no pop-ups, no feeds. [00:20] You slide a single physical switch and it captures studio audio in two hundred milliseconds. [00:28] Great hardware disappears the moment you start thinking. [00:34] That is why we spent nine months perfecting the feel of one button.",
    waveform: buildStudioWaveform(2.9),
    audioPeaks: [6.8, 14.5, 21.3, 29.4, 36.2],
    starterClips: [
      {
        id: "key-clip-1",
        title: "Why we removed every notification",
        hook: "Every device on your desk is fighting for your attention.",
        reason:
          "Strong relatable opening tension resolved by a crisp physical product reveal.",
        category: "Product Reveal",
        hookStrength: "Strong Hook",
        startTime: 0.5,
        endTime: 20.0,
        focusX: 50,
        zoom: 1.15,
        description:
          "What if your hardware stayed completely quiet until you needed it?",
        hashtags: ["industrialdesign", "hardware", "minimalism", "tech"],
        captions: [
          {
            id: "kc1-1",
            startTime: 0.5,
            endTime: 5.5,
            text: "Every device fights for attention.",
            highlightWord: "attention.",
          },
          {
            id: "kc1-2",
            startTime: 5.5,
            endTime: 12.2,
            text: "What if tools stayed completely silent?",
            highlightWord: "silent?",
          },
          {
            id: "kc1-3",
            startTime: 12.2,
            endTime: 16.0,
            text: "One solid block of aluminum.",
            highlightWord: "aluminum.",
          },
          {
            id: "kc1-4",
            startTime: 16.0,
            endTime: 20.0,
            text: "No pop-ups. No feeds.",
            highlightWord: "No",
          },
        ],
      },
      {
        id: "key-clip-2",
        title: "9 months spent on a single switch",
        hook: "Great hardware disappears the moment you start thinking.",
        reason:
          "Memorable design philosophy line paired with a specific craft detail.",
        category: "Design Craft",
        hookStrength: "Key Takeaway",
        startTime: 20.0,
        endTime: 41.0,
        focusX: 50,
        zoom: 1.2,
        description:
          "200ms boot-to-record from one tactile switch.",
        hashtags: ["design", "craft", "keynote", "audio"],
        captions: [
          {
            id: "kc2-1",
            startTime: 20.0,
            endTime: 27.5,
            text: "Slide one switch: instant studio audio.",
            highlightWord: "instant",
          },
          {
            id: "kc2-2",
            startTime: 27.5,
            endTime: 33.8,
            text: "Great hardware disappears as you think.",
            highlightWord: "disappears",
          },
          {
            id: "kc2-3",
            startTime: 33.8,
            endTime: 41.0,
            text: "Nine months perfecting one single button.",
            highlightWord: "Nine",
          },
        ],
      },
    ],
  },
  {
    id: "sample-creator",
    title: "Creator Breakdown — Lighting a Dark Studio Desk",
    creator: "FrameCraft Studio",
    category: "Tutorial",
    duration: 45,
    image: "/src/assets/images/sample_creator_desk_1795075220646.jpg",
    summary:
      "Fast practical lighting lesson showing how one diffused softbox and a warm practical lamp create cinema contrast in a small room.",
    transcript:
      "[00:00] You don't need a five-thousand-dollar camera to make your videos look cinematic. [00:06] Look at what happens when you turn off the ceiling light first. [00:11] Flat overhead light kills depth immediately. [00:16] Instead, place one large softbox at forty-five degrees right beside your monitor. [00:23] Now add a single warm practical lamp behind your shoulder to separate you from the wall. [00:31] Keep your shadows dark — contrast is what makes skin tones pop on camera. [00:38] Two lights, five minutes, completely transformed frame.",
    waveform: buildStudioWaveform(4.6),
    audioPeaks: [4.2, 12.6, 22.8, 32.1, 40.5],
    starterClips: [
      {
        id: "cr-clip-1",
        title: "Turn off your ceiling light first",
        hook: "You don't need a $5,000 camera to look cinematic.",
        reason:
          "Classic myth-busting tutorial opener with an immediately actionable 2-light setup.",
        category: "Tutorial",
        hookStrength: "Strong Hook",
        startTime: 0.0,
        endTime: 23.0,
        focusX: 50,
        zoom: 1.05,
        description:
          "Fix flat YouTube lighting in 5 minutes with one softbox and a desk lamp.",
        hashtags: ["filmmaking", "lighting", "youtubetips", "videography"],
        captions: [
          {
            id: "cc1-1",
            startTime: 0.0,
            endTime: 5.8,
            text: "Skip the five-thousand-dollar camera.",
            highlightWord: "Skip",
          },
          {
            id: "cc1-2",
            startTime: 5.8,
            endTime: 11.2,
            text: "Turn off your ceiling light first.",
            highlightWord: "ceiling",
          },
          {
            id: "cc1-3",
            startTime: 11.2,
            endTime: 16.0,
            text: "Flat overhead light kills depth.",
            highlightWord: "kills",
          },
          {
            id: "cc1-4",
            startTime: 16.0,
            endTime: 23.0,
            text: "Place one softbox at 45 degrees.",
            highlightWord: "45",
          },
        ],
      },
      {
        id: "cr-clip-2",
        title: "Why dark shadows make frames pop",
        hook: "Keep your shadows dark — contrast makes skin tones pop.",
        reason:
          "Compact visual rule of thumb with strong save-and-rewatch value for creators.",
        category: "Lighting Tip",
        hookStrength: "Key Takeaway",
        startTime: 23.0,
        endTime: 44.5,
        focusX: 50,
        zoom: 1.1,
        description:
          "Add one warm practical lamp behind your shoulder for instant depth.",
        hashtags: ["cinematography", "studio", "creator", "lightingdesign"],
        captions: [
          {
            id: "cc2-1",
            startTime: 23.0,
            endTime: 30.8,
            text: "Add one warm lamp behind you.",
            highlightWord: "warm",
          },
          {
            id: "cc2-2",
            startTime: 30.8,
            endTime: 37.8,
            text: "Keep shadows dark for rich contrast.",
            highlightWord: "contrast.",
          },
          {
            id: "cc2-3",
            startTime: 37.8,
            endTime: 44.5,
            text: "Two lights. Five minutes. Cinema look.",
            highlightWord: "Cinema",
          },
        ],
      },
    ],
  },
];
