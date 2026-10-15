import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Series,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// DESIGN.md: Doodle Poster tokens
const THEME = {
  bg: '#fcf9ef',
  surface: '#fffdfa',
  surface2: '#f1ede2',
  line: '#d3cec1',
  ink: '#1a160c',
  ink2: '#6d695c',
  accent: '#0888be',
  accentInk: '#0479a9',
  onAccent: '#071822',
  ok: '#1d7d3e',
  warn: '#8d5e05',
  danger: '#a7463e',
} as const;

const FONTS = {
  display: '"Unbounded", system-ui, sans-serif',
  text: '"Golos Text", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',
} as const;

// Scene 1: Hook & Brand Intro (65 frames)
const HookScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const settle = spring({ frame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill
      className="tabular-nums"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 96,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <div
        style={{
          transform: `translateY(${(1 - settle) * 24}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
          textAlign: 'center',
        }}
      >
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: '1.416rem',
            color: THEME.accentInk,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 500,
          }}
        >
          Continuous Close Platform
        </span>

        <h1
          style={{
            fontFamily: FONTS.display,
            fontSize: '7rem',
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: '-0.015em',
            color: THEME.ink,
            margin: 0,
          }}
        >
          Ledgerly
        </h1>

        <div
          style={{
            backgroundColor: THEME.surface,
            border: `2px solid ${THEME.ink}`,
            boxShadow: `4px 4px 0 ${THEME.ink}`,
            borderRadius: 16,
            padding: '20px 44px',
            display: 'flex',
            alignItems: 'center',
            gap: 24,
          }}
        >
          <span
            style={{
              fontFamily: FONTS.display,
              fontSize: '1.888rem',
              color: THEME.ink,
              fontWeight: 600,
            }}
          >
            Financial close in hours, not weeks
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 2: Lead Feature - Automated Bank Reconciliation (140 frames)
const ReconciliationScene = () => {
  const frame = useCurrentFrame();
  const grow = interpolate(frame, [0, 24], [0.94, 1], {
    easing: Easing.bezier(0.2, 0, 0, 1),
    extrapolateRight: 'clamp',
  });
  const badgeSlide = interpolate(frame, [25, 45], [18, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      className="tabular-nums"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 96,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <div
        style={{
          width: 1120,
          transform: `scale(${grow})`,
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: '1.063rem',
                color: THEME.accentInk,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 500,
              }}
            >
              Key Feature 01
            </span>
            <h2
              style={{
                fontFamily: FONTS.display,
                fontSize: '3rem',
                fontWeight: 600,
                lineHeight: 1.05,
                letterSpacing: '-0.015em',
                color: THEME.ink,
                margin: '8px 0 0 0',
              }}
            >
              Automated Bank Reconciliation
            </h2>
          </div>

          <div
            style={{
              textAlign: 'right',
            }}
          >
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: '3.355rem',
                fontWeight: 600,
                color: THEME.accent,
                lineHeight: 1,
              }}
            >
              98.4%
            </div>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: '0.797rem',
                color: THEME.ink,
                marginTop: 6,
                letterSpacing: '0.04em',
              }}
            >
              Auto-matched on arrival
            </div>
          </div>
        </div>

        {/* Hero Data Card */}
        <div
          style={{
            backgroundColor: THEME.surface,
            border: `2px solid ${THEME.ink}`,
            boxShadow: `4px 4px 0 ${THEME.ink}`,
            borderRadius: 16,
            padding: 36,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div
            style={{
              backgroundColor: THEME.surface2,
              borderRadius: 10,
              padding: '16px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: '0.797rem',
                  color: THEME.ink,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Direct Bank Feed
              </div>
              <div
                style={{
                  fontFamily: FONTS.text,
                  fontSize: '1.416rem',
                  fontWeight: 600,
                  color: THEME.ink,
                  marginTop: 4,
                }}
              >
                Stripe Payout #9421
              </div>
            </div>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: '1.888rem',
                fontWeight: 500,
                color: THEME.ink,
              }}
            >
              $14,250.00
            </div>
          </div>

          <div
            style={{
              backgroundColor: THEME.surface2,
              borderRadius: 10,
              padding: '16px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: '0.797rem',
                  color: THEME.ink,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                General Ledger Match
              </div>
              <div
                style={{
                  fontFamily: FONTS.text,
                  fontSize: '1.416rem',
                  fontWeight: 600,
                  color: THEME.ink,
                  marginTop: 4,
                }}
              >
                Invoice INV-2026-081 · Apex Labs Ltd
              </div>
            </div>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: '1.888rem',
                fontWeight: 500,
                color: THEME.ink,
              }}
            >
              $14,250.00
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 8,
              transform: `translateY(${badgeSlide}px)`,
            }}
          >
            <div
              style={{
                backgroundColor: THEME.ok,
                color: THEME.surface,
                fontFamily: FONTS.mono,
                fontSize: '0.797rem',
                fontWeight: 500,
                borderRadius: 10,
                padding: '8px 18px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Match Confirmed · Zero Discrepancy
            </div>

            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: '0.797rem',
                color: THEME.ink,
              }}
            >
              Reconciled across 1,420 transactions
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 3: Feature 2 - Real-Time Audit Trail (95 frames)
const AuditScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mask = interpolate(frame, [0, 20], [100, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const stamp = spring({
    frame: Math.max(0, frame - 18),
    fps,
    config: { damping: 200 },
  });

  return (
    <AbsoluteFill
      className="tabular-nums"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 96,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <div
        style={{
          width: 1120,
          clipPath: `inset(0 0 ${mask}% 0)`,
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: '1.063rem',
                color: THEME.accentInk,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 500,
              }}
            >
              Key Feature 02
            </span>
            <h2
              style={{
                fontFamily: FONTS.display,
                fontSize: '3rem',
                fontWeight: 600,
                lineHeight: 1.05,
                letterSpacing: '-0.015em',
                color: THEME.ink,
                margin: '8px 0 0 0',
              }}
            >
              Real-Time Audit Trail
            </h2>
          </div>

          <div
            style={{
              transform: `scale(${stamp})`,
              backgroundColor: THEME.accent,
              color: THEME.onAccent,
              fontFamily: FONTS.mono,
              fontSize: '0.797rem',
              fontWeight: 500,
              borderRadius: 10,
              padding: '8px 16px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Cryptographic Log
          </div>
        </div>

        <div
          style={{
            backgroundColor: THEME.surface,
            border: `2px solid ${THEME.ink}`,
            boxShadow: `4px 4px 0 ${THEME.ink}`,
            borderRadius: 16,
            padding: 36,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div
            style={{
              backgroundColor: THEME.surface2,
              borderRadius: 10,
              padding: '16px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: '1.063rem',
                  fontWeight: 500,
                  color: THEME.ink,
                }}
              >
                Log #8841-B · Disbursal Verification
              </span>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: '0.797rem',
                  color: THEME.ink,
                }}
              >
                Timestamp: 2026-10-15 07:16:53 UTC
              </span>
            </div>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: '0.797rem',
                color: THEME.ok,
                fontWeight: 600,
              }}
            >
              SHA-256 Verified
            </span>
          </div>

          <div
            style={{
              backgroundColor: THEME.surface2,
              borderRadius: 10,
              padding: '16px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: '1.063rem',
                  fontWeight: 500,
                  color: THEME.ink,
                }}
              >
                Log #8842-A · Tax Accrual Journal
              </span>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: '0.797rem',
                  color: THEME.ink,
                }}
              >
                Timestamp: 2026-10-15 07:16:54 UTC
              </span>
            </div>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: '0.797rem',
                color: THEME.ok,
                fontWeight: 600,
              }}
            >
              SHA-256 Verified
            </span>
          </div>

          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: '0.797rem',
              color: THEME.ink,
              paddingTop: 4,
            }}
          >
            Export compliance packages in one click
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 4: Feature 3 - Multi-Entity Currency Settlement (80 frames)
const SettlementScene = () => {
  const frame = useCurrentFrame();
  const balanceScale = interpolate(frame, [0, 22], [0.92, 1], {
    easing: Easing.out(Easing.quad),
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      className="tabular-nums"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 96,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <div
        style={{
          width: 1120,
          transform: `scale(${balanceScale})`,
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: '1.063rem',
                color: THEME.accentInk,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 500,
              }}
            >
              Key Feature 03
            </span>
            <h2
              style={{
                fontFamily: FONTS.display,
                fontSize: '3rem',
                fontWeight: 600,
                lineHeight: 1.05,
                letterSpacing: '-0.015em',
                color: THEME.ink,
                margin: '8px 0 0 0',
              }}
            >
              Multi-Entity Currency Settlement
            </h2>
          </div>

          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: '1.063rem',
              color: THEME.ink,
            }}
          >
            34 currencies supported
          </div>
        </div>

        <div
          style={{
            backgroundColor: THEME.surface,
            border: `2px solid ${THEME.ink}`,
            boxShadow: `4px 4px 0 ${THEME.ink}`,
            borderRadius: 16,
            padding: 36,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 20,
            }}
          >
            <div
              style={{
                flex: 1,
                backgroundColor: THEME.surface2,
                borderRadius: 10,
                padding: '20px 24px',
              }}
            >
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: '0.797rem',
                  color: THEME.ink,
                  textTransform: 'uppercase',
                }}
              >
                North America (USD)
              </div>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: '1.888rem',
                  fontWeight: 600,
                  color: THEME.ink,
                  marginTop: 6,
                }}
              >
                $842,500.00
              </div>
            </div>

            <div
              style={{
                flex: 1,
                backgroundColor: THEME.surface2,
                borderRadius: 10,
                padding: '20px 24px',
              }}
            >
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: '0.797rem',
                  color: THEME.ink,
                  textTransform: 'uppercase',
                }}
              >
                Europe Ops (EUR)
              </div>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: '1.888rem',
                  fontWeight: 600,
                  color: THEME.ink,
                  marginTop: 6,
                }}
              >
                €612,140.00
              </div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: THEME.surface2,
              borderRadius: 10,
              padding: '16px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: '1.063rem',
                color: THEME.ink,
                fontWeight: 500,
              }}
            >
              Consolidated Balance (USD)
            </span>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: '1.888rem',
                fontWeight: 600,
                color: THEME.accent,
              }}
            >
              $1,745,280.00
            </span>
          </div>

          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: '0.797rem',
              color: THEME.ink,
              paddingTop: 4,
            }}
          >
            Automatic mid-market foreign exchange revaluation
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 5: Closing Call to Action (70 frames)
const CtaScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ctaSettle = spring({ frame, fps, config: { damping: 200 } });
  const buttonRise = interpolate(frame, [10, 28], [16, 0], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      className="tabular-nums"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 96,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <div
        style={{
          transform: `scale(${ctaSettle})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 32,
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontFamily: FONTS.display,
            fontSize: '6.5rem',
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: '-0.015em',
            color: THEME.ink,
            margin: 0,
          }}
        >
          Ledgerly
        </h1>

        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: '2rem',
            color: THEME.accentInk,
            fontWeight: 600,
          }}
        >
          Automate your financial close today
        </div>

        <div
          style={{
            transform: `translateY(${buttonRise}px)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            marginTop: 8,
          }}
        >
          <a
            href="https://ledgerly.com"
            style={{
              textDecoration: 'none',
              backgroundColor: THEME.accent,
              color: THEME.onAccent,
              fontFamily: FONTS.display,
              fontSize: '1.888rem',
              fontWeight: 600,
              padding: '20px 52px',
              borderRadius: 16,
              border: `2px solid ${THEME.ink}`,
              boxShadow: `4px 4px 0 ${THEME.ink}`,
              display: 'inline-block',
            }}
          >
            Start free trial
          </a>

          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: '1.416rem',
              color: THEME.ink,
              fontWeight: 500,
            }}
          >
            ledgerly.com
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Main Composition: 15 seconds @ 30 fps = 450 frames
export const Launch = () => {
  const musicVolume = (f: number) =>
    interpolate(f, [0, 20, 360, 430, 450], [0.12, 0.3, 0.22, 0.32, 0.05], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

  return (
    <AbsoluteFill
      className="tabular-nums"
      style={{
        backgroundColor: THEME.bg,
        fontFamily: FONTS.text,
        color: THEME.ink,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {/* Background Music: scored across the 450 frames */}
      <Audio src={staticFile('music.mp3')} volume={musicVolume} />

      {/* Sound Effects: 4 distinct key moments, mixed levels */}
      <Sequence from={52} durationInFrames={20}>
        <Audio src={staticFile('sfx/whoosh.mp3')} volume={0.2} />
      </Sequence>
      <Sequence from={115} durationInFrames={25}>
        <Audio src={staticFile('sfx/pop.mp3')} volume={0.22} />
      </Sequence>
      <Sequence from={230} durationInFrames={25}>
        <Audio src={staticFile('sfx/click.mp3')} volume={0.18} />
      </Sequence>
      <Sequence from={350} durationInFrames={30}>
        <Audio src={staticFile('sfx/riser.mp3')} volume={0.25} />
      </Sequence>

      {/* Varied scene lengths: 65, 140, 95, 80, 70 = 450 frames */}
      <Series>
        <Series.Sequence durationInFrames={65}>
          <HookScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={140}>
          <ReconciliationScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={95}>
          <AuditScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={80}>
          <SettlementScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={70}>
          <CtaScene />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
