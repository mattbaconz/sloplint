import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const BG = "#0b1220";
const ACCENT = "#34d399";
const FG = "#f8fafc";
const MUTED = "#94a3b8";
const FONT = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif";

const FEATURES = [
  { icon: "⚡", title: "Instant entries", body: "Log income and expenses in seconds." },
  { icon: "📊", title: "Live reports", body: "See where your money goes, always up to date." },
  { icon: "🔒", title: "Secure by default", body: "Your books stay private and backed up." },
];

// Frame layout (30 fps, 450 frames = 15s)
const INTRO = 0;
const FEATURE_START = 90;
const FEATURE_LEN = 90;
const CTA = 360;

const useEnter = (delay = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 200 } });
};

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const p = useEnter(5);
  const sub = useEnter(25);
  const out = interpolate(frame, [75, 90], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: out }}>
      <div
        style={{
          fontSize: 200,
          fontWeight: 800,
          color: FG,
          letterSpacing: -4,
          transform: `scale(${interpolate(p, [0, 1], [0.8, 1])})`,
          opacity: p,
        }}
      >
        Ledger<span style={{ color: ACCENT }}>ly</span>
      </div>
      <div
        style={{
          fontSize: 44,
          color: MUTED,
          marginTop: 10,
          opacity: sub,
          transform: `translateY(${interpolate(sub, [0, 1], [20, 0])}px)`,
        }}
      >
        Your books, finally effortless.
      </div>
    </AbsoluteFill>
  );
};

const Feature: React.FC<{ index: number }> = ({ index }) => {
  const frame = useCurrentFrame();
  const f = FEATURES[index];
  const p = useEnter(0);
  const text = useEnter(8);
  const out = interpolate(frame, [FEATURE_LEN - 12, FEATURE_LEN], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: out }}>
      <div style={{ fontSize: 28, color: ACCENT, fontWeight: 700, letterSpacing: 6, opacity: p }}>
        {`0${index + 1} / 03`}
      </div>
      <div
        style={{
          fontSize: 150,
          marginTop: 20,
          transform: `scale(${interpolate(p, [0, 1], [0.3, 1])})`,
          opacity: p,
        }}
      >
        {f.icon}
      </div>
      <div
        style={{
          fontSize: 110,
          fontWeight: 800,
          color: FG,
          marginTop: 10,
          opacity: text,
          transform: `translateX(${interpolate(text, [0, 1], [-80, 0])}px)`,
        }}
      >
        {f.title}
      </div>
      <div
        style={{
          fontSize: 44,
          color: MUTED,
          marginTop: 16,
          opacity: text,
          transform: `translateX(${interpolate(text, [0, 1], [80, 0])}px)`,
        }}
      >
        {f.body}
      </div>
    </AbsoluteFill>
  );
};

const Cta: React.FC = () => {
  const p = useEnter(0);
  const btn = useEnter(18);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          fontSize: 120,
          fontWeight: 800,
          color: FG,
          opacity: p,
          transform: `translateY(${interpolate(p, [0, 1], [40, 0])}px)`,
        }}
      >
        Take control of your books.
      </div>
      <div
        style={{
          marginTop: 60,
          padding: "28px 80px",
          borderRadius: 999,
          background: ACCENT,
          color: BG,
          fontSize: 56,
          fontWeight: 800,
          opacity: btn,
          transform: `scale(${interpolate(btn, [0, 1], [0.7, 1])})`,
        }}
      >
        Start free at ledgerly.app
      </div>
    </AbsoluteFill>
  );
};

export const Launch: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const drift = interpolate(frame, [0, durationInFrames], [0, 200]);
  const musicVolume = interpolate(
    frame,
    [0, 20, durationInFrames - 30, durationInFrames],
    [0, 0.5, 0.5, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: FONT }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${30 + drift / 10}% 40%, rgba(52,211,153,0.22), transparent 55%)`,
        }}
      />

      <Audio src={staticFile("music.mp3")} volume={musicVolume} />

      <Sequence from={INTRO} durationInFrames={FEATURE_START}>
        <Intro />
        <Audio src={staticFile("sfx/pop.mp3")} volume={0.8} />
      </Sequence>

      {FEATURES.map((_, i) => (
        <Sequence
          key={i}
          from={FEATURE_START + i * FEATURE_LEN}
          durationInFrames={FEATURE_LEN}
        >
          <Feature index={i} />
          <Audio src={staticFile(i === 1 ? "sfx/click.mp3" : "sfx/whoosh.mp3")} volume={0.7} />
        </Sequence>
      ))}

      {/* Riser builds into the call to action */}
      <Sequence from={CTA - 45} durationInFrames={45}>
        <Audio src={staticFile("sfx/riser.mp3")} volume={0.6} />
      </Sequence>

      <Sequence from={CTA}>
        <Cta />
        <Audio src={staticFile("sfx/pop.mp3")} volume={0.8} />
      </Sequence>
    </AbsoluteFill>
  );
};
