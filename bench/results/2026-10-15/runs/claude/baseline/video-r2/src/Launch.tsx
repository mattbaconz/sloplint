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

const BG = "#0b1020";
const ACCENT = "#5eead4";
const ACCENT_2 = "#818cf8";
const FONT =
  "Inter, 'Segoe UI', system-ui, -apple-system, Helvetica, Arial, sans-serif";

const FEATURES = [
  { title: "Automatic categorization", body: "Every transaction sorted the moment it lands.", icon: "⚡" },
  { title: "Real-time reconciliation", body: "Books that balance themselves, always up to date.", icon: "🔄" },
  { title: "One-click reports", body: "Investor-ready statements, generated instantly.", icon: "📊" },
];

// Timeline (frames @ 30fps, 450 total)
const INTRO = { from: 0, dur: 90 };
const FEATURE_START = 90;
const FEATURE_DUR = 80;
const CTA = { from: 330, dur: 120 };

const useEnter = (delay = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 200 } });
};

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const shift = interpolate(frame, [0, 450], [0, 360]);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${30 + shift / 12}% 30%, ${ACCENT_2}33, transparent 55%), radial-gradient(circle at 75% ${80 - shift / 20}%, ${ACCENT}22, transparent 50%), ${BG}`,
      }}
    />
  );
};

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = useEnter(5);
  const sub = useEnter(25);
  const exit = interpolate(frame, [75, 90], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "center", opacity: exit, fontFamily: FONT }}
    >
      <div
        style={{
          fontSize: 190,
          fontWeight: 800,
          letterSpacing: -6,
          color: "white",
          transform: `scale(${interpolate(enter, [0, 1], [0.8, 1])})`,
          opacity: enter,
        }}
      >
        Ledger<span style={{ color: ACCENT }}>ly</span>
      </div>
      <div
        style={{
          marginTop: 20,
          fontSize: 48,
          color: "#cbd5e1",
          opacity: sub,
          transform: `translateY(${interpolate(sub, [0, 1], [30, 0])}px)`,
        }}
      >
        Accounting that runs itself.
      </div>
    </AbsoluteFill>
  );
};

const Feature: React.FC<{ index: number }> = ({ index }) => {
  const frame = useCurrentFrame();
  const f = FEATURES[index];
  const enter = useEnter(0);
  const text = useEnter(10);
  const exit = interpolate(frame, [FEATURE_DUR - 10, FEATURE_DUR], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT, opacity: exit }}
    >
      <div style={{ position: "absolute", top: 120, display: "flex", gap: 16 }}>
        {FEATURES.map((_, i) => (
          <div
            key={i}
            style={{
              width: 80,
              height: 8,
              borderRadius: 4,
              background: i === index ? ACCENT : "#334155",
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 70,
          transform: `translateX(${interpolate(enter, [0, 1], [160, 0])}px)`,
          opacity: enter,
        }}
      >
        <div
          style={{
            width: 280,
            height: 280,
            borderRadius: 64,
            background: `linear-gradient(135deg, ${ACCENT_2}, ${ACCENT})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 140,
            boxShadow: `0 30px 80px ${ACCENT_2}55`,
          }}
        >
          {f.icon}
        </div>
        <div style={{ width: 960, opacity: text, transform: `translateY(${interpolate(text, [0, 1], [24, 0])}px)` }}>
          <div style={{ fontSize: 28, color: ACCENT, fontWeight: 700, letterSpacing: 4 }}>
            0{index + 1} / 03
          </div>
          <div style={{ fontSize: 88, fontWeight: 800, color: "white", lineHeight: 1.05, marginTop: 12 }}>
            {f.title}
          </div>
          <div style={{ fontSize: 40, color: "#cbd5e1", marginTop: 24 }}>{f.body}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const enter = useEnter(0);
  const btn = useEnter(20);
  const frame = useCurrentFrame();
  const pulse = 1 + 0.03 * Math.sin(frame / 5);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
      <div
        style={{
          fontSize: 110,
          fontWeight: 800,
          color: "white",
          textAlign: "center",
          opacity: enter,
          transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`,
        }}
      >
        Close your books in minutes.
      </div>
      <div
        style={{
          marginTop: 60,
          padding: "28px 72px",
          borderRadius: 100,
          background: `linear-gradient(90deg, ${ACCENT_2}, ${ACCENT})`,
          color: BG,
          fontSize: 56,
          fontWeight: 800,
          opacity: btn,
          transform: `scale(${interpolate(btn, [0, 1], [0.7, 1]) * pulse})`,
        }}
      >
        Start free at ledgerly.com
      </div>
    </AbsoluteFill>
  );
};

export const Launch: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: BG }}>
      <Background />

      {/* Music: fade in, fade out over the last second */}
      <Audio
        src={staticFile("music.mp3")}
        volume={(f) =>
          interpolate(f, [0, 20, durationInFrames - 30, durationInFrames], [0, 0.5, 0.5, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />

      <Sequence from={INTRO.from} durationInFrames={INTRO.dur}>
        <Intro />
        <Audio src={staticFile("sfx/pop.mp3")} volume={0.8} />
      </Sequence>

      {FEATURES.map((_, i) => (
        <Sequence key={i} from={FEATURE_START + i * FEATURE_DUR} durationInFrames={FEATURE_DUR}>
          <Feature index={i} />
          <Audio src={staticFile(i === 0 ? "sfx/whoosh.mp3" : "sfx/click.mp3")} volume={0.7} />
        </Sequence>
      ))}

      {/* Riser building into the CTA */}
      <Sequence from={CTA.from - 45} durationInFrames={45}>
        <Audio src={staticFile("sfx/riser.mp3")} volume={0.6} />
      </Sequence>

      <Sequence from={CTA.from} durationInFrames={CTA.dur}>
        <Outro />
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.7} />
        <Sequence from={20}>
          <Audio src={staticFile("sfx/pop.mp3")} volume={0.8} />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};
