import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const LAUNCH_FPS = 30;
export const LAUNCH_DURATION = 15 * LAUNCH_FPS;

const COLORS = {
  bg: "#0b1020",
  bgAlt: "#131a33",
  text: "#f5f7ff",
  muted: "#9aa6cf",
  accent: "#5eead4",
  accent2: "#818cf8",
};

const FONT = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif";

const FEATURES = [
  { icon: "⚡", title: "Instant Reconciliation", body: "Match every transaction to your books automatically." },
  { icon: "📊", title: "Live Cash Insights", body: "Real-time dashboards that show where your money moves." },
  { icon: "🔒", title: "Bank-Grade Security", body: "Encrypted end to end, with audit-ready history." },
];

const INTRO = { from: 0, dur: 90 };
const FEATURE_DUR = 90;
const FEATURES_FROM = 90;
const CTA = { from: 360, dur: 90 };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const angle = 135 + frame * 0.15;
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${angle}deg, ${COLORS.bg}, ${COLORS.bgAlt} 60%, #1b1f4a)`,
      }}
    />
  );
};

const useFadeOut = (dur: number, fade = 12) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [dur - fade, dur], [1, 0], clamp);
};

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = useFadeOut(INTRO.dur);
  const s = spring({ frame: frame - 6, fps, config: { damping: 12, mass: 0.8 } });
  const tagOpacity = interpolate(frame, [30, 50], [0, 1], clamp);
  const tagY = interpolate(frame, [30, 50], [24, 0], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        fontFamily: FONT,
        opacity: fade,
      }}
    >
      <div
        style={{
          fontSize: 190,
          fontWeight: 800,
          letterSpacing: -4,
          color: COLORS.text,
          transform: `scale(${interpolate(s, [0, 1], [0.6, 1])})`,
          opacity: s,
        }}
      >
        Ledger<span style={{ color: COLORS.accent }}>ly</span>
      </div>
      <div
        style={{
          fontSize: 48,
          color: COLORS.muted,
          marginTop: 12,
          opacity: tagOpacity,
          transform: `translateY(${tagY}px)`,
        }}
      >
        Accounting, without the busywork.
      </div>
    </AbsoluteFill>
  );
};

const FeatureScene: React.FC<{
  index: number;
  icon: string;
  title: string;
  body: string;
}> = ({ index, icon, title, body }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = useFadeOut(FEATURE_DUR, 10);
  const enter = spring({ frame, fps, config: { damping: 14 } });
  const x = interpolate(enter, [0, 1], [160, 0]);
  const bodyOpacity = interpolate(frame, [14, 34], [0, 1], clamp);
  const iconScale = spring({ frame: frame - 20, fps, config: { damping: 8 } });
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        fontFamily: FONT,
        opacity: fade,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 80,
          transform: `translateX(${x}px)`,
          opacity: enter,
        }}
      >
        <div
          style={{
            width: 280,
            height: 280,
            borderRadius: 64,
            background: `linear-gradient(135deg, ${COLORS.accent2}, ${COLORS.accent})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 140,
            transform: `scale(${iconScale})`,
            boxShadow: "0 30px 80px rgba(94,234,212,0.25)",
          }}
        >
          {icon}
        </div>
        <div style={{ maxWidth: 900 }}>
          <div style={{ fontSize: 34, color: COLORS.accent, fontWeight: 700, letterSpacing: 4 }}>
            FEATURE {index + 1} / 3
          </div>
          <div style={{ fontSize: 96, fontWeight: 800, color: COLORS.text, lineHeight: 1.05, marginTop: 8 }}>
            {title}
          </div>
          <div style={{ fontSize: 42, color: COLORS.muted, marginTop: 20, opacity: bodyOpacity }}>
            {body}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12 } });
  const pulse = 1 + 0.03 * Math.sin(frame / 5);
  const fadeIn = interpolate(frame, [0, 12], [0, 1], clamp);
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        fontFamily: FONT,
        opacity: fadeIn,
      }}
    >
      <div
        style={{
          fontSize: 110,
          fontWeight: 800,
          color: COLORS.text,
          transform: `scale(${interpolate(s, [0, 1], [0.8, 1])})`,
        }}
      >
        Close your books faster.
      </div>
      <div
        style={{
          marginTop: 56,
          padding: "28px 72px",
          borderRadius: 999,
          fontSize: 56,
          fontWeight: 700,
          color: COLORS.bg,
          background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accent2})`,
          transform: `scale(${pulse})`,
        }}
      >
        Start free at ledgerly.com
      </div>
    </AbsoluteFill>
  );
};

const Sfx: React.FC<{ file: string; volume?: number }> = ({ file, volume = 0.8 }) => (
  <Audio src={staticFile(`sfx/${file}`)} volume={volume} />
);

export const Launch: React.FC = () => {
  const musicVolume = (f: number) =>
    interpolate(
      f,
      [0, 20, LAUNCH_DURATION - 30, LAUNCH_DURATION],
      [0, 0.45, 0.45, 0],
      clamp,
    );

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Background />

      <Audio src={staticFile("music.mp3")} volume={musicVolume} />

      <Sequence from={INTRO.from} durationInFrames={INTRO.dur}>
        <Intro />
      </Sequence>

      {FEATURES.map((f, i) => (
        <Sequence
          key={f.title}
          from={FEATURES_FROM + i * FEATURE_DUR}
          durationInFrames={FEATURE_DUR}
        >
          <FeatureScene index={i} {...f} />
        </Sequence>
      ))}

      <Sequence from={CTA.from} durationInFrames={CTA.dur}>
        <Cta />
      </Sequence>

      {/* Sound design */}
      <Sequence from={6} durationInFrames={45}>
        <Sfx file="pop.mp3" />
      </Sequence>
      {FEATURES.map((f, i) => {
        const start = FEATURES_FROM + i * FEATURE_DUR;
        return (
          <React.Fragment key={f.title}>
            <Sequence from={start} durationInFrames={45}>
              <Sfx file="whoosh.mp3" />
            </Sequence>
            <Sequence from={start + 20} durationInFrames={30}>
              <Sfx file="click.mp3" volume={0.6} />
            </Sequence>
          </React.Fragment>
        );
      })}
      <Sequence from={CTA.from - 30} durationInFrames={30}>
        <Sfx file="riser.mp3" volume={0.7} />
      </Sequence>
      <Sequence from={CTA.from} durationInFrames={45}>
        <Sfx file="pop.mp3" />
      </Sequence>
    </AbsoluteFill>
  );
};
