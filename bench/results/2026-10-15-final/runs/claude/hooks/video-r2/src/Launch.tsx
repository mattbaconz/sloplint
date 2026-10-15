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

export const LAUNCH_FRAMES = 450;

// Scene lengths follow what each beat has to show: 84 + 108 + 96 + 99 + 63.
const S = {
  intro: {from: 0, len: 84},
  one: {from: 84, len: 108},
  two: {from: 192, len: 96},
  three: {from: 288, len: 99},
  cta: {from: 387, len: 63},
};

const css = `
@import url("https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;600&family=IBM+Plex+Mono:wght@400;500&display=swap");
.lg {
  --bg: #f0f3f7; --surface: #f6f8fa; --surface-2: #e4e8ec; --line: #c4c9cd;
  --ink: #13161a; --ink-2: #62676b; --accent: #1a5c8c; --on-accent: #f7fbfe;
  --font-display: "Public Sans", system-ui, sans-serif;
  --font-text: "Public Sans", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace;
  --radius: 6px;
  background: var(--bg); color: var(--ink); font-family: var(--font-text);
}
.lg .mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.lg .display { font-family: var(--font-display); font-weight: 600; line-height: 1.05; letter-spacing: -0.01em; }
`;

const ease = Easing.bezier(0.2, 0, 0, 1);
const useProgress = (delay = 0, durationInFrames = 24) => {
  const frame = useCurrentFrame();
  return interpolate(frame - delay, [0, durationInFrames], [0, 1], {
    easing: ease,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

const Rule: React.FC<{p?: number}> = ({p = 1}) => (
  <div style={{height: 1, background: "var(--line)", transform: `scaleX(${p})`, transformOrigin: "left"}} />
);

const Intro: React.FC = () => {
  const mask = useProgress(0, 26);
  const sub = useProgress(30, 18);
  const rule = useProgress(10, 40);
  return (
    <AbsoluteFill style={{padding: "0 160px", justifyContent: "center"}}>
      <div className="mono" style={{fontSize: 28, color: "var(--accent)", opacity: sub, marginBottom: 28}}>
        LEDGERLY / RELEASE NOTES
      </div>
      <div
        className="display"
        style={{
          fontSize: 260,
          clipPath: `inset(0 ${(1 - mask) * 100}% 0 0)`,
        }}
      >
        Ledgerly
      </div>
      <div style={{margin: "36px 0"}}>
        <Rule p={rule} />
      </div>
      <div style={{fontSize: 52, opacity: sub, maxWidth: 1100}}>
        Books that reconcile as you work.
      </div>
    </AbsoluteFill>
  );
};

type Feature = {n: string; name: string; detail: string};
const FEATURES: Feature[] = [
  {n: "01", name: "Bank feeds", detail: "Every bank transaction is matched to an invoice or flagged for your review."},
  {n: "02", name: "Invoicing", detail: "Send an invoice and see the day it is paid, on the same ledger."},
  {n: "03", name: "Month-end reports", detail: "Reports come from the ledger itself, so nothing is re-keyed to close."},
];

const FeatureScene: React.FC<{index: 0 | 1 | 2}> = ({index}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const f = FEATURES[index];
  const settle = spring({frame, fps, config: {damping: 200}, durationInFrames: 26});
  // Each feature arrives its own way: slide, rise, or simply on the cut.
  const numStyle: React.CSSProperties =
    index === 0
      ? {transform: `translateX(${(1 - settle) * -120}px)`, opacity: settle}
      : index === 1
        ? {transform: `translateY(${(1 - settle) * 80}px)`}
        : {};
  const detail = useProgress(index === 2 ? 0 : 14, 18);
  return (
    <AbsoluteFill style={{padding: "0 160px", justifyContent: "center"}}>
      <div style={{display: "flex", gap: 56, alignItems: "baseline"}}>
        <div className="mono" style={{fontSize: 220, color: "var(--accent)", fontWeight: 500, ...numStyle}}>
          {f.n}
        </div>
        <div className="display" style={{fontSize: 120, opacity: index === 1 ? settle : 1}}>
          {f.name}
        </div>
      </div>
      <div style={{margin: "40px 0"}}>
        <Rule p={useProgress(4, 30)} />
      </div>
      <div style={{fontSize: 52, lineHeight: 1.4, maxWidth: 1250, opacity: detail}}>{f.detail}</div>
      <div className="mono" style={{position: "absolute", right: 160, bottom: 90, fontSize: 28, color: "var(--ink-2)"}}>
        {f.n} / 03
      </div>
    </AbsoluteFill>
  );
};

const Cta: React.FC = () => {
  const head = useProgress(0, 16);
  const btn = spring({frame: useCurrentFrame() - 14, fps: 30, config: {damping: 200}, durationInFrames: 18});
  return (
    <AbsoluteFill style={{padding: "0 160px", justifyContent: "center"}}>
      <div className="display" style={{fontSize: 150, opacity: head}}>
        Close the month from one ledger.
      </div>
      <div style={{marginTop: 64, transform: `scale(${0.94 + 0.06 * btn})`, transformOrigin: "left", opacity: btn}}>
        <span
          style={{
            display: "inline-block",
            background: "var(--accent)",
            color: "var(--on-accent)",
            fontSize: 48,
            fontWeight: 600,
            padding: "28px 48px",
            borderRadius: "var(--radius)",
          }}
        >
          Start your Ledgerly ledger
        </span>
      </div>
    </AbsoluteFill>
  );
};

export const Launch: React.FC = () => {
  return (
    <AbsoluteFill className="lg">
      <style>{css}</style>

      {/* Music sits low and fades out over the last second. */}
      <Audio
        src={staticFile("music.mp3")}
        volume={(f) =>
          interpolate(f, [0, 15, LAUNCH_FRAMES - 30, LAUNCH_FRAMES], [0, 0.28, 0.28, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />

      <Sequence from={S.intro.from} durationInFrames={S.intro.len}>
        <Intro />
      </Sequence>
      <Sequence from={S.one.from} durationInFrames={S.one.len}>
        <FeatureScene index={0} />
      </Sequence>
      <Sequence from={S.two.from} durationInFrames={S.two.len}>
        <FeatureScene index={1} />
      </Sequence>
      <Sequence from={S.three.from} durationInFrames={S.three.len}>
        <FeatureScene index={2} />
      </Sequence>
      <Sequence from={S.cta.from} durationInFrames={S.cta.len}>
        <Cta />
      </Sequence>

      {/* Music carries most cuts; four sounds, each used once at a moment that matters. */}
      <Sequence from={S.one.from - 4}>
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.18} />
      </Sequence>
      <Sequence from={S.two.from + 20}>
        <Audio src={staticFile("sfx/click.mp3")} volume={0.15} />
      </Sequence>
      <Sequence from={S.three.from + 24}>
        <Audio src={staticFile("sfx/pop.mp3")} volume={0.15} />
      </Sequence>
      <Sequence from={S.cta.from - 30} durationInFrames={30}>
        <Audio src={staticFile("sfx/riser.mp3")} volume={0.2} />
      </Sequence>
    </AbsoluteFill>
  );
};
