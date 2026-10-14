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

// Scene lengths in frames at 30 fps, sized to what each scene shows:
// name, bank feeds, invoices, close, call to action.
const SCENE_FRAMES = [60, 120, 84, 96, 90];
export const TOTAL_FRAMES = SCENE_FRAMES.reduce((a, b) => a + b, 0); // 450 = 15 s

const STARTS = SCENE_FRAMES.map((_, i) =>
  SCENE_FRAMES.slice(0, i).reduce((a, b) => a + b, 0)
);

const C = {
  surface: "#15171a",
  bg: "#0e0f11",
  line: "#2a2e34",
  ink: "#e8e6e1",
  ink2: "#9a9ea6",
  accent: "#f2a33a",
  onAccent: "#1a1206",
  good: "#5fbf8f",
};
const SANS = '"IBM Plex Sans", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

// DESIGN.md type scale (12, 14, 16, 20, 28, 40) doubled for 1080p.
const T = { label: 24, body: 32, h2: 56, h1: 80, hero: 144 };
const RADIUS = 12;
const PAD = 32;
const BORDER = 2;
const RADIUS_INNER = Math.max(0, RADIUS - PAD - BORDER);

const easeOut = (t: number) => Easing.out(Easing.cubic)(t);

// Critically damped: no overshoot.
const useCalm = (delay = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 200 } });
};

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontFamily: SANS,
      fontSize: T.label,
      fontWeight: 500,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: C.ink2,
    }}
  >
    {children}
  </div>
);

const Heading: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <h2
    style={{
      fontFamily: SANS,
      fontSize: T.h1,
      fontWeight: 600,
      lineHeight: 1.15,
      color: C.ink,
      margin: 0,
      maxWidth: 760,
      ...style,
    }}
  >
    {children}
  </h2>
);

const Panel: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      width: 800,
      background: C.surface,
      border: `${BORDER}px solid ${C.line}`,
      borderRadius: RADIUS,
      padding: PAD,
      ...style,
    }}
  >
    {children}
  </div>
);

const Row: React.FC<{
  first?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ first, children, style }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      height: 72,
      borderTop: first ? "none" : `${BORDER}px solid ${C.line}`,
      fontFamily: SANS,
      fontSize: T.body,
      color: C.ink,
      ...style,
    }}
  >
    {children}
  </div>
);

const num: React.CSSProperties = {
  fontFamily: MONO,
  fontVariantNumeric: "tabular-nums",
};

const sceneLayout = (
  direction: "row" | "row-reverse"
): React.CSSProperties => ({
  flexDirection: direction,
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 160px",
});

// Scene 1: the wordmark is revealed by a mask wipe; it is the only mover.
const NameScene: React.FC = () => {
  const p = useCalm(4);
  const rule = useCalm(14);
  return (
    <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 160 }}>
      <div style={{ clipPath: `inset(0 ${interpolate(p, [0, 1], [100, 0])}% 0 0)` }}>
        <div
          style={{
            fontFamily: SANS,
            fontSize: T.hero,
            fontWeight: 600,
            color: C.ink,
            lineHeight: 1.15,
          }}
        >
          Ledgerly
        </div>
      </div>
      <div
        style={{
          height: 8,
          width: 560 * rule,
          background: C.accent,
          marginTop: 24,
        }}
      />
    </AbsoluteFill>
  );
};

const MATCHES: [string, string, string][] = [
  ["Stripe payout", "+4,210.00", "Matched"],
  ["AWS invoice", "-1,186.42", "Matched"],
  ["Rent, October", "-2,400.00", "Matched"],
  ["Payroll run", "-18,930.15", "Matched"],
  ["Unknown wire", "+310.00", "Review"],
];

// Scene 2: the heading is simply there on the cut; rows land on an eased spread.
const FeedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const panel = useCalm(0);
  const n = MATCHES.length;
  return (
    <AbsoluteFill style={sceneLayout("row")}>
      <Heading>Bank feeds reconcile themselves</Heading>
      <Panel
        style={{
          transform: `scale(${interpolate(panel, [0, 1], [0.96, 1])})`,
          opacity: panel,
        }}
      >
        <Label>Reconciliation, 14 Oct</Label>
        <div style={{ marginTop: 16 }}>
          {MATCHES.map(([name, amt, status], i) => {
            const at = 10 + Math.round(easeOut(i / (n - 1)) * 36);
            const o = interpolate(frame, [at, at + 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <Row key={name} first={i === 0} style={{ opacity: o }}>
                <span>{name}</span>
                <span style={{ display: "flex", gap: 32, alignItems: "baseline" }}>
                  <span style={num}>{amt}</span>
                  <span
                    style={{
                      width: 140,
                      textAlign: "right",
                      fontSize: T.label,
                      color: status === "Matched" ? C.good : C.accent,
                    }}
                  >
                    {status}
                  </span>
                </span>
              </Row>
            );
          })}
        </div>
      </Panel>
    </AbsoluteFill>
  );
};

// Scene 3: a counter; the panel slides in and the heading arrives quietly.
const InvoiceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const p = useCalm(0);
  const hs = useCalm(4);
  const count = interpolate(frame, [6, 50], [0, 6], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={sceneLayout("row-reverse")}>
      <Heading
        style={{
          opacity: hs,
          transform: `translateY(${interpolate(hs, [0, 1], [16, 0])}px)`,
        }}
      >
        Invoices get paid sooner
      </Heading>
      <Panel
        style={{ transform: `translateX(${interpolate(p, [0, 1], [-120, 0])}px)` }}
      >
        <Label>Average days to payment</Label>
        <div
          style={{ display: "flex", alignItems: "baseline", gap: 24, marginTop: 24 }}
        >
          <span
            style={{
              ...num,
              fontSize: T.hero,
              fontWeight: 600,
              color: C.accent,
              lineHeight: 1,
            }}
          >
            {count.toFixed(0)}
          </span>
          <span style={{ fontFamily: SANS, fontSize: T.h2, color: C.ink }}>
            days sooner
          </span>
        </div>
        <Row style={{ marginTop: 32, borderTop: `${BORDER}px solid ${C.line}` }}>
          <span>Reminders sent automatically</span>
          <span style={num}>3</span>
        </Row>
      </Panel>
    </AbsoluteFill>
  );
};

const CLOSE_BARS: [string, number, boolean][] = [
  ["Jul", 9, false],
  ["Aug", 7, false],
  ["Sep", 5, false],
  ["Oct", 1, true],
];

// Scene 4: bars grow on one curve; the accent bar is the one that matters.
const CloseScene: React.FC = () => {
  const p = useCalm(6);
  return (
    <AbsoluteFill style={sceneLayout("row")}>
      <Heading>Month-end close in one day</Heading>
      <Panel>
        <Label>Days to close</Label>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 32,
            height: 360,
            marginTop: 24,
            borderBottom: `${BORDER}px solid ${C.line}`,
          }}
        >
          {CLOSE_BARS.map(([m, v, hot]) => (
            <div
              key={m}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                height: "100%",
              }}
            >
              <span style={{ ...num, fontSize: T.body, color: C.ink, marginBottom: 8 }}>
                {v}
              </span>
              <div
                style={{
                  width: "100%",
                  height: (v / 9) * 280 * p,
                  background: hot ? C.accent : C.ink2,
                  borderRadius: RADIUS_INNER,
                }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 32, marginTop: 12 }}>
          {CLOSE_BARS.map(([m]) => (
            <span
              key={m}
              style={{
                flex: 1,
                textAlign: "center",
                fontFamily: SANS,
                fontSize: T.label,
                color: C.ink2,
              }}
            >
              {m}
            </span>
          ))}
        </div>
      </Panel>
    </AbsoluteFill>
  );
};

// Scene 5: the headline is masked in; the button is there on the cut.
const CtaScene: React.FC = () => {
  const p = useCalm(2);
  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "flex-start", paddingLeft: 160 }}
    >
      <div
        style={{ clipPath: `inset(0 0 ${interpolate(p, [0, 1], [100, 0])}% 0)` }}
      >
        <Heading style={{ fontSize: T.hero, maxWidth: 1400 }}>
          Close your books faster
        </Heading>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 32, marginTop: 64 }}>
        <div
          style={{
            height: 96,
            padding: "0 48px",
            display: "flex",
            alignItems: "center",
            borderRadius: RADIUS,
            background: C.accent,
            color: C.onAccent,
            fontFamily: SANS,
            fontSize: T.h2,
            fontWeight: 600,
          }}
        >
          Start free trial
        </div>
        <span style={{ fontFamily: MONO, fontSize: T.body, color: C.ink }}>
          ledgerly.com
        </span>
      </div>
    </AbsoluteFill>
  );
};

const SCENES = [NameScene, FeedScene, InvoiceScene, CloseScene, CtaScene];

export const Launch: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    {/* Music carries most cuts; it sits low and fades out over the last second. */}
    <Audio
      src={staticFile("music.mp3")}
      volume={(f) =>
        interpolate(f, [0, 15, TOTAL_FRAMES - 30, TOTAL_FRAMES], [0, 0.28, 0.28, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      }
    />

    {SCENES.map((Scene, i) => (
      <Sequence key={i} from={STARTS[i]} durationInFrames={SCENE_FRAMES[i]}>
        <Scene />
      </Sequence>
    ))}

    {/* Four moments get their own sound at different levels; other cuts ride the music. */}
    <Sequence from={STARTS[1] - 6} durationInFrames={30}>
      <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.18} />
    </Sequence>
    <Sequence from={STARTS[2] + 8} durationInFrames={30}>
      <Audio src={staticFile("sfx/click.mp3")} volume={0.12} playbackRate={1.1} />
    </Sequence>
    <Sequence from={STARTS[4] - 45} durationInFrames={45}>
      <Audio src={staticFile("sfx/riser.mp3")} volume={0.15} />
    </Sequence>
    <Sequence from={STARTS[4]} durationInFrames={30}>
      <Audio src={staticFile("sfx/pop.mp3")} volume={0.22} />
    </Sequence>
  </AbsoluteFill>
);
