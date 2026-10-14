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
  bg: "#0b1220",
  bgAccent: "#12203d",
  text: "#f5f7fb",
  muted: "#93a1bd",
  accent: "#4ade80",
  accent2: "#38bdf8",
};

const FONT =
  'Inter, "Segoe UI", system-ui, -apple-system, Helvetica, Arial, sans-serif';

// Timeline (frames @ 30fps)
const INTRO_END = 90; // 0-3s
const FEATURE_LEN = 80;
const FEATURES_START = INTRO_END; // 3s
const CTA_START = FEATURES_START + FEATURE_LEN * 3; // 330 = 11s

const FEATURES = [
  {
    title: "Automatic categorization",
    body: "Every transaction sorted the moment it lands.",
    icon: "⚡",
  },
  {
    title: "Live cash-flow view",
    body: "See where your money is going, in real time.",
    icon: "📈",
  },
  {
    title: "One-click reports",
    body: "Investor-ready statements, exported in seconds.",
    icon: "🧾",
  },
];

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, LAUNCH_DURATION], [0, 120]);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${30 + drift / 6}% ${
          20 + drift / 10
        }%, ${COLORS.bgAccent} 0%, ${COLORS.bg} 60%)`,
      }}
    />
  );
};

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 6, fps, config: { damping: 12 } });
  const tag = interpolate(frame, [30, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(frame, [INTRO_END - 12, INTRO_END], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        opacity: exit,
      }}
    >
      <div
        style={{
          fontSize: 200,
          fontWeight: 800,
          letterSpacing: -6,
          color: COLORS.text,
          transform: `scale(${0.6 + 0.4 * pop})`,
          opacity: pop,
        }}
      >
        Ledger<span style={{ color: COLORS.accent }}>ly</span>
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 48,
          color: COLORS.muted,
          opacity: tag,
          transform: `translateY(${(1 - tag) * 20}px)`,
        }}
      >
        Your books, finally effortless.
      </div>
    </AbsoluteFill>
  );
};

const Feature: React.FC<{
  index: number;
  title: string;
  body: string;
  icon: string;
}> = ({ index, title, body, icon }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 15 } });
  const exit = interpolate(frame, [FEATURE_LEN - 10, FEATURE_LEN], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const iconPop = spring({ frame: frame - 14, fps, config: { damping: 10 } });
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        opacity: exit,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 80,
          transform: `translateX(${(1 - enter) * 300}px)`,
          opacity: enter,
        }}
      >
        <div
          style={{
            width: 280,
            height: 280,
            borderRadius: 64,
            background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 140,
            transform: `scale(${iconPop})`,
          }}
        >
          {icon}
        </div>
        <div style={{ maxWidth: 1000 }}>
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              color: COLORS.accent,
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            Feature {index + 1} / 3
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              color: COLORS.text,
              lineHeight: 1.05,
              marginTop: 12,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 44, color: COLORS.muted, marginTop: 20 }}>
            {body}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CallToAction: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 12 } });
  const button = spring({ frame: frame - 18, fps, config: { damping: 10 } });
  const pulse = 1 + 0.03 * Math.sin(frame / 5);
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          fontSize: 110,
          fontWeight: 800,
          color: COLORS.text,
          textAlign: "center",
          transform: `scale(${0.8 + 0.2 * enter})`,
          opacity: enter,
        }}
      >
        Start for free today
      </div>
      <div
        style={{
          marginTop: 56,
          padding: "28px 72px",
          borderRadius: 999,
          background: COLORS.accent,
          color: COLORS.bg,
          fontSize: 60,
          fontWeight: 800,
          transform: `scale(${button * pulse})`,
          opacity: button,
        }}
      >
        ledgerly.com
      </div>
    </AbsoluteFill>
  );
};

export const Launch: React.FC = () => {
  // Music: fade in over 1s, fade out over the last 1.5s.
  const musicVolume = (f: number) =>
    interpolate(
      f,
      [0, 30, LAUNCH_DURATION - 45, LAUNCH_DURATION],
      [0, 0.6, 0.6, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Background />

      {/* Background music for the whole video */}
      <Audio src={staticFile("music.mp3")} volume={musicVolume} />

      {/* Intro */}
      <Sequence from={0} durationInFrames={INTRO_END}>
        <Intro />
        <Sequence from={0}>
          <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.7} />
        </Sequence>
        <Sequence from={6}>
          <Audio src={staticFile("sfx/pop.mp3")} volume={0.8} />
        </Sequence>
      </Sequence>

      {/* Features */}
      {FEATURES.map((f, i) => (
        <Sequence
          key={f.title}
          from={FEATURES_START + i * FEATURE_LEN}
          durationInFrames={FEATURE_LEN}
        >
          <Feature index={i} {...f} />
          <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.6} />
          <Sequence from={14}>
            <Audio src={staticFile("sfx/click.mp3")} volume={0.8} />
          </Sequence>
        </Sequence>
      ))}

      {/* Riser builds through the last feature into the CTA */}
      <Sequence from={CTA_START - 45} durationInFrames={45}>
        <Audio src={staticFile("sfx/riser.mp3")} volume={0.7} />
      </Sequence>

      {/* Call to action */}
      <Sequence from={CTA_START}>
        <CallToAction />
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.6} />
        <Sequence from={18}>
          <Audio src={staticFile("sfx/pop.mp3")} volume={0.9} />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};
