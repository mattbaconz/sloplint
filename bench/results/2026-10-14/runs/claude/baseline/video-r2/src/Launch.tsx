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

const FPS = 30;
const s = (sec: number) => Math.round(sec * FPS);

const COLORS = {
  bg: "#0B1020",
  bgAlt: "#131A33",
  text: "#F4F6FF",
  muted: "#9AA4C7",
  accent: "#5B8CFF",
  accent2: "#2EE6A6",
};

const FONT =
  'Inter, "Segoe UI", system-ui, -apple-system, Helvetica, Arial, sans-serif';

const FEATURES = [
  {
    icon: "⚡",
    title: "Instant Categorization",
    body: "Every transaction sorted automatically, the moment it lands.",
  },
  {
    icon: "📈",
    title: "Live Cash Flow",
    body: "See where your money is going, in real time.",
  },
  {
    icon: "🧾",
    title: "One-Click Reports",
    body: "Audit-ready statements, exported in a single click.",
  },
];

// Timeline (seconds): intro 0-3, features 3-12 (3s each), CTA 12-15
const INTRO_END = 3;
const FEATURE_LEN = 3;
const CTA_START = 12;
const TOTAL = 15;

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, s(TOTAL)], [0, 120]);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${30 + drift / 6}% ${
          25 + drift / 10
        }%, ${COLORS.bgAlt} 0%, ${COLORS.bg} 60%)`,
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 85% 90%, ${COLORS.accent}22 0%, transparent 45%)`,
        }}
      />
    </AbsoluteFill>
  );
};

const FadeWrap: React.FC<{ duration: number; children: React.ReactNode }> = ({
  duration,
  children,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, 8, duration - 8, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 6, fps, config: { damping: 12 } });
  const tag = spring({ frame: frame - 28, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT }}
    >
      <div
        style={{
          fontSize: 200,
          fontWeight: 800,
          letterSpacing: -6,
          color: COLORS.text,
          transform: `scale(${interpolate(pop, [0, 1], [0.6, 1])})`,
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
          transform: `translateY(${interpolate(tag, [0, 1], [24, 0])}px)`,
        }}
      >
        Bookkeeping, finally effortless.
      </div>
    </AbsoluteFill>
  );
};

const FeatureScene: React.FC<{ index: number }> = ({ index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = FEATURES[index];
  const enter = spring({ frame: frame - 4, fps, config: { damping: 16 } });
  const text = spring({ frame: frame - 14, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT }}
    >
      <div style={{ position: "absolute", top: 90, display: "flex", gap: 16 }}>
        {FEATURES.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === index ? 64 : 20,
              height: 10,
              borderRadius: 5,
              background: i === index ? COLORS.accent : COLORS.muted + "55",
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 90,
          transform: `translateX(${interpolate(enter, [0, 1], [160, 0])}px)`,
          opacity: enter,
        }}
      >
        <div
          style={{
            width: 360,
            height: 360,
            borderRadius: 80,
            background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accent2})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 170,
            boxShadow: `0 40px 120px ${COLORS.accent}55`,
          }}
        >
          {f.icon}
        </div>
        <div style={{ width: 880 }}>
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: 6,
              color: COLORS.accent2,
              textTransform: "uppercase",
            }}
          >
            Feature 0{index + 1}
          </div>
          <div
            style={{
              fontSize: 104,
              fontWeight: 800,
              color: COLORS.text,
              lineHeight: 1.05,
              marginTop: 12,
              letterSpacing: -2,
              opacity: text,
              transform: `translateY(${interpolate(text, [0, 1], [30, 0])}px)`,
            }}
          >
            {f.title}
          </div>
          <div
            style={{
              fontSize: 44,
              color: COLORS.muted,
              marginTop: 28,
              lineHeight: 1.3,
              opacity: text,
            }}
          >
            {f.body}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = spring({ frame: frame - 4, fps, config: { damping: 14 } });
  const button = spring({ frame: frame - 24, fps, config: { damping: 10 } });
  const pulse = 1 + 0.03 * Math.sin(frame / 6);
  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT }}
    >
      <div
        style={{
          fontSize: 120,
          fontWeight: 800,
          color: COLORS.text,
          letterSpacing: -3,
          textAlign: "center",
          opacity: title,
          transform: `scale(${interpolate(title, [0, 1], [0.85, 1])})`,
        }}
      >
        Take control of your books.
      </div>
      <div
        style={{
          marginTop: 70,
          padding: "30px 80px",
          borderRadius: 100,
          fontSize: 56,
          fontWeight: 700,
          color: COLORS.bg,
          background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accent2})`,
          opacity: button,
          transform: `scale(${interpolate(button, [0, 1], [0.5, 1]) * pulse})`,
          boxShadow: `0 30px 90px ${COLORS.accent}66`,
        }}
      >
        Start free at ledgerly.com
      </div>
    </AbsoluteFill>
  );
};

export const Launch: React.FC = () => {
  const frame = useCurrentFrame();
  const end = s(TOTAL);
  // Music: fade in, hold, fade out at the end.
  const musicVolume = interpolate(
    frame,
    [0, s(1), end - s(1.5), end],
    [0, 0.5, 0.5, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Background />

      <Audio src={staticFile("music.mp3")} volume={musicVolume} />

      {/* Intro */}
      <Sequence from={0} durationInFrames={s(INTRO_END)}>
        <FadeWrap duration={s(INTRO_END)}>
          <Intro />
        </FadeWrap>
      </Sequence>

      {/* Features */}
      {FEATURES.map((_, i) => (
        <Sequence
          key={i}
          from={s(INTRO_END + i * FEATURE_LEN)}
          durationInFrames={s(FEATURE_LEN)}
        >
          <FadeWrap duration={s(FEATURE_LEN)}>
            <FeatureScene index={i} />
          </FadeWrap>
        </Sequence>
      ))}

      {/* CTA */}
      <Sequence from={s(CTA_START)} durationInFrames={s(TOTAL - CTA_START)}>
        <FadeWrap duration={s(TOTAL - CTA_START)}>
          <CTA />
        </FadeWrap>
      </Sequence>

      {/* Sound effects */}
      <Sequence from={s(0.15)} durationInFrames={s(2)}>
        <Audio src={staticFile("sfx/pop.mp3")} volume={0.8} />
      </Sequence>
      {FEATURES.map((_, i) => {
        const from = s(INTRO_END + i * FEATURE_LEN);
        return (
          <React.Fragment key={i}>
            <Sequence from={from} durationInFrames={s(1.5)}>
              <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.7} />
            </Sequence>
            <Sequence from={from + 14} durationInFrames={s(1)}>
              <Audio src={staticFile("sfx/click.mp3")} volume={0.7} />
            </Sequence>
          </React.Fragment>
        );
      })}
      <Sequence from={s(CTA_START - 1.5)} durationInFrames={s(1.5)}>
        <Audio src={staticFile("sfx/riser.mp3")} volume={0.7} />
      </Sequence>
      <Sequence from={s(CTA_START)} durationInFrames={s(1.5)}>
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.7} />
      </Sequence>
      <Sequence from={s(CTA_START) + 24} durationInFrames={s(1.5)}>
        <Audio src={staticFile("sfx/pop.mp3")} volume={0.9} />
      </Sequence>
    </AbsoluteFill>
  );
};
