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
} from 'remotion';

// Scene lengths in frames at 30 fps: the name is quick, the first feature
// holds longest because it carries the core idea, the call to action lingers.
const SCENES = [84, 108, 84, 78, 96];
const [NAME, MATCH, SEND, CLOSE, CTA] = SCENES;

export const TOTAL_FRAMES = SCENES.reduce((a, b) => a + b, 0);

const START_MATCH = NAME;
const START_SEND = START_MATCH + MATCH;
const START_CLOSE = START_SEND + SEND;
const START_CTA = START_CLOSE + CLOSE;

const tokens = `
@import url("https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&family=Azeret+Mono:wght@400;500&display=swap");
.ledgerly {
  --bg: #0a0d11;
  --line: #2c3035;
  --ink: #ecf0f4;
  --ink-2: #9a9fa5;
  --accent: #ffa987;
  --on-accent: #21110b;
  --font-display: "Archivo", system-ui, sans-serif;
  --font-mono: "Azeret Mono", ui-monospace, Menlo, Consolas, monospace;
  --radius: 4px;
}
.ledgerly .mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
`;

const ease = Easing.bezier(0.2, 0, 0, 1);

const useProgress = (from: number, to: number) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [from, to], [0, 1], {
    easing: ease,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
};

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      background: 'var(--bg)',
      color: 'var(--ink)',
      fontFamily: 'var(--font-display)',
    }}
  >
    {children}
  </AbsoluteFill>
);

// Scene 1: the wordmark is the hero and is unmasked from the left; the rule draws under it.
const NameScene = () => {
  const reveal = useProgress(0, 26);
  const rule = useProgress(18, 40);
  return (
    <Frame>
      <AbsoluteFill style={{ justifyContent: 'center', padding: '0 160px' }}>
        <h1
          style={{
            margin: 0,
            fontSize: 280,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            clipPath: `inset(0 ${(1 - reveal) * 100}% 0 0)`,
          }}
        >
          Ledgerly
        </h1>
        <div
          style={{
            height: 4,
            width: 1600 * rule,
            background: 'var(--accent)',
            marginTop: 40,
          }}
        />
        <p style={{ fontSize: 44, color: 'var(--ink-2)', margin: '36px 0 0' }}>
          Invoicing and bookkeeping in one ledger.
        </p>
      </AbsoluteFill>
    </Frame>
  );
};

type Feature = { n: string; name: string; detail: string };

const FEATURES: Feature[] = [
  {
    n: '01',
    name: 'Bank matching',
    detail: 'Each deposit is matched to the invoice it pays.',
  },
  {
    n: '02',
    name: 'Invoice sending',
    detail: 'Send an invoice by email and see when it is opened.',
  },
  {
    n: '03',
    name: 'Month-end close',
    detail: 'Lock the period and export the ledger as CSV.',
  },
];

// Each feature scene gives its numeral a different entrance: mask, slide, or simply there on the cut.
const FeatureScene: React.FC<{
  index: number;
  variant: 'mask' | 'slide' | 'cut';
}> = ({ index, variant }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const main = useProgress(0, 22);
  const detail = useProgress(10, 30);
  const settle = spring({ frame, fps, config: { damping: 200 } });

  const feature = FEATURES[index];
  const others = FEATURES.filter((_, i) => i !== index);

  const numeralStyle: React.CSSProperties =
    variant === 'slide'
      ? { transform: `translateX(${(1 - settle) * -120}px)` }
      : variant === 'mask'
        ? { clipPath: `inset(${(1 - main) * 100}% 0 0 0)` }
        : {};

  return (
    <Frame>
      <AbsoluteFill style={{ padding: '120px 160px', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 80 }}>
          <div
            className="mono"
            style={{
              fontSize: 360,
              fontWeight: 500,
              color: 'var(--accent)',
              lineHeight: 1,
              ...numeralStyle,
            }}
          >
            {feature.n}
          </div>
          <div style={{ flex: 1 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 120,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
              }}
            >
              {feature.name}
            </h2>
            <p
              style={{
                margin: '28px 0 0',
                fontSize: 48,
                lineHeight: 1.3,
                color: 'var(--ink-2)',
                opacity: detail,
              }}
            >
              {feature.detail}
            </p>
          </div>
        </div>
        <div style={{ marginTop: 120, borderTop: '1px solid var(--line)' }}>
          {others.map((o) => (
            <div
              key={o.n}
              style={{
                display: 'flex',
                gap: 40,
                padding: '20px 0',
                borderBottom: '1px solid var(--line)',
                fontSize: 32,
                color: 'var(--ink-2)',
              }}
            >
              <span className="mono">{o.n}</span>
              <span>{o.name}</span>
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </Frame>
  );
};

const CtaScene = () => {
  const grow = useProgress(0, 20);
  const link = useProgress(30, 46);
  return (
    <Frame>
      <AbsoluteFill style={{ justifyContent: 'center', padding: '0 160px' }}>
        <h2
          style={{
            margin: 0,
            fontSize: 160,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            transform: `scale(${0.92 + 0.08 * grow})`,
            transformOrigin: 'left center',
          }}
        >
          Close the books in one place.
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 48, marginTop: 72 }}>
          <div
            style={{
              height: 96,
              padding: '0 48px',
              display: 'flex',
              alignItems: 'center',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              borderRadius: 'var(--radius)',
              fontSize: 44,
              fontWeight: 600,
            }}
          >
            Create your account
          </div>
          <span
            className="mono"
            style={{ fontSize: 40, color: 'var(--ink-2)', opacity: link }}
          >
            ledgerly.com
          </span>
        </div>
      </AbsoluteFill>
    </Frame>
  );
};

export const Launch: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill className="ledgerly" style={{ background: 'var(--bg)' }}>
      <style>{tokens}</style>

      {/* Music bed sits low, fades in over the first second and out over the last 1.5s. */}
      <Audio
        src={staticFile('music.mp3')}
        volume={(f) =>
          interpolate(
            f,
            [0, fps, TOTAL_FRAMES - fps * 1.5, TOTAL_FRAMES],
            [0, 0.28, 0.28, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          )
        }
      />

      <Sequence from={0} durationInFrames={NAME}>
        <NameScene />
      </Sequence>
      <Sequence from={START_MATCH} durationInFrames={MATCH}>
        <FeatureScene index={0} variant="mask" />
      </Sequence>
      <Sequence from={START_SEND} durationInFrames={SEND}>
        <FeatureScene index={1} variant="slide" />
      </Sequence>
      <Sequence from={START_CLOSE} durationInFrames={CLOSE}>
        <FeatureScene index={2} variant="cut" />
      </Sequence>
      <Sequence from={START_CTA} durationInFrames={CTA}>
        <CtaScene />
      </Sequence>

      {/* Three effects, each used once at its own level; the music carries the other cuts. */}
      <Sequence from={6}>
        <Audio src={staticFile('sfx/pop.mp3')} volume={0.18} />
      </Sequence>
      <Sequence from={START_CTA - 45}>
        <Audio src={staticFile('sfx/riser.mp3')} volume={0.12} />
      </Sequence>
      <Sequence from={START_CTA + 22}>
        <Audio src={staticFile('sfx/click.mp3')} volume={0.22} />
      </Sequence>
    </AbsoluteFill>
  );
};
