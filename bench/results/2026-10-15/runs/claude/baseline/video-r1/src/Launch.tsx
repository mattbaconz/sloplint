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

export const LAUNCH_FPS = 30;
export const LAUNCH_DURATION = 15 * LAUNCH_FPS; // 450 frames

const COLORS = {
  bg: "#0b1020",
  accent: "#4f8cff",
  accent2: "#7c5cff",
  text: "#ffffff",
  muted: "#a8b3cf",
};

const FONT = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif";

const FEATURES = [
  { icon: "⚡", title: "Instant Reconciliation", body: "Match every transaction automatically, in seconds." },
  { icon: "📊", title: "Live Cash Insights", body: "See your real-time position across all accounts." },
  { icon: "🔒", title: "Audit-Ready Always", body: "Bank-grade security with a complete audit trail." },
];

const INTRO_END = 105;
const FEATURE_LEN = 80;
const CTA_START = INTRO_END + FEATURE_LEN * FEATURES.length; // 345

const useEnter = (delay = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 110 } });
};

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const shift = interpolate(frame, [0, LAUNCH_DURATION], [0, 60]);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${30 + shift / 3}% ${40 + shift / 6}%, #1b2a5c 0%, ${COLORS.bg} 60%)`,
      }}
    />
  );
};

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = useEnter(8);
  const sub = useEnter(24);
  const out = interpolate(frame, [INTRO_END - 15, INTRO_END], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: out }}>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 190,
          fontWeight: 800,
          letterSpacing: -4,
          color: COLORS.text,
          transform: `scale(${interpolate(enter, [0, 1], [0.6, 1])})`,
          opacity: enter,
        }}
      >
        Ledger<span style={{ color: COLORS.accent }}>ly</span>
      </div>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 52,
          color: COLORS.muted,
          marginTop: 10,
          opacity: sub,
          transform: `translateY(${interpolate(sub, [0, 1], [30, 0])}px)`,
        }}
      >
        Accounting, finally effortless.
      </div>
    </AbsoluteFill>
  );
};

const Feature: React.FC<{ index: number; icon: string; title: string; body: string }> = ({
  index,
  icon,
  title,
  body,
}) => {
  const frame = useCurrentFrame();
  const enter = useEnter(0);
  const out = interpolate(frame, [FEATURE_LEN - 10, FEATURE_LEN], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: out }}>
      <div
        style={{
          fontFamily: FONT,
          display: "flex",
          alignItems: "center",
          gap: 60,
          transform: `translateX(${interpolate(enter, [0, 1], [200, 0])}px)`,
          opacity: enter,
        }}
      >
        <div
          style={{
            width: 240,
            height: 240,
            borderRadius: 56,
            background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: 120,
          }}
        >
          {icon}
        </div>
        <div style={{ maxWidth: 960 }}>
          <div style={{ fontSize: 30, color: COLORS.accent, fontWeight: 700, letterSpacing: 4 }}>
            FEATURE {index + 1} / {FEATURES.length}
          </div>
          <div style={{ fontSize: 96, fontWeight: 800, color: COLORS.text, lineHeight: 1.05 }}>{title}</div>
          <div style={{ fontSize: 44, color: COLORS.muted, marginTop: 16 }}>{body}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CTA: React.FC = () => {
  const enter = useEnter(0);
  const button = useEnter(15);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: FONT }}>
      <div
        style={{
          fontSize: 120,
          fontWeight: 800,
          color: COLORS.text,
          opacity: enter,
          transform: `scale(${interpolate(enter, [0, 1], [0.8, 1])})`,
        }}
      >
        Start with Ledgerly today
      </div>
      <div
        style={{
          marginTop: 60,
          padding: "28px 80px",
          borderRadius: 100,
          fontSize: 52,
          fontWeight: 700,
          color: COLORS.text,
          background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accent2})`,
          opacity: button,
          transform: `translateY(${interpolate(button, [0, 1], [40, 0])}px)`,
        }}
      >
        Try it free at ledgerly.com
      </div>
    </AbsoluteFill>
  );
};

export const Launch: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Background />

      {/* Music with fade in/out */}
      <Audio
        src={staticFile("music.mp3")}
        volume={(f) =>
          interpolate(f, [0, 20, durationInFrames - 30, durationInFrames], [0, 0.5, 0.5, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />

      {/* Scenes */}
      <Sequence from={0} durationInFrames={INTRO_END}>
        <Intro />
      </Sequence>
      {FEATURES.map((f, i) => (
        <Sequence key={f.title} from={INTRO_END + i * FEATURE_LEN} durationInFrames={FEATURE_LEN}>
          <Feature index={i} {...f} />
        </Sequence>
      ))}
      <Sequence from={CTA_START} durationInFrames={durationInFrames - CTA_START}>
        <CTA />
      </Sequence>

      {/* Sound effects */}
      <Sequence from={0}>
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.8} />
      </Sequence>
      <Sequence from={8}>
        <Audio src={staticFile("sfx/pop.mp3")} volume={0.7} />
      </Sequence>
      {FEATURES.map((f, i) => (
        <Sequence key={`sfx-${f.title}`} from={INTRO_END + i * FEATURE_LEN}>
          <Audio src={staticFile("sfx/click.mp3")} volume={0.7} />
        </Sequence>
      ))}
      <Sequence from={CTA_START - 45}>
        <Audio src={staticFile("sfx/riser.mp3")} volume={0.7} />
      </Sequence>
      <Sequence from={CTA_START + 15}>
        <Audio src={staticFile("sfx/pop.mp3")} volume={0.8} />
      </Sequence>
    </AbsoluteFill>
  );
};
