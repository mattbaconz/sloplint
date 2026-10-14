import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const COLORS = {
  bg: '#0e0f11',
  surface: '#15171a',
  raised: '#1c1f23',
  line: '#2a2e34',
  ink: '#e8e6e1',
  ink2: '#9a9ea6',
  accent: '#f2a33a',
  onAccent: '#1a1206',
  good: '#5fbf8f',
  warn: '#e6c15a',
  bad: '#ef6b5b',
};

const FONTS = {
  body: '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  display: '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: '"IBM Plex Mono", "SF Mono", Consolas, "Liberation Mono", Menlo, Courier, monospace',
};

const HeaderShell: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 56,
      padding: '0 48px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: `1px solid ${COLORS.line}`,
      backgroundColor: COLORS.surface,
      zIndex: 10,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          width: 8,
          height: 8,
          backgroundColor: COLORS.accent,
          borderRadius: 2,
        }}
      />
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: COLORS.ink,
        }}
      >
        LEDGERLY // INSTRUMENT PANEL
      </span>
    </div>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 32,
        fontFamily: FONTS.mono,
        fontSize: 12,
        color: COLORS.ink2,
      }}
    >
      <span>
        STATE:{' '}
        <strong style={{ color: COLORS.good, fontWeight: 500 }}>
          ACTIVE
        </strong>
      </span>
      <span>
        CLK: <strong style={{ color: COLORS.ink, fontWeight: 500 }} className="tabular-nums">30.00 FPS</strong>
      </span>
      <span>
        NETWORK: <strong style={{ color: COLORS.ink, fontWeight: 500 }}>ISOLATED</strong>
      </span>
    </div>
  </div>
);

const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const heroSpring = spring({
    frame,
    fps,
    config: { damping: 200, overshootClamping: true },
  });

  const heroScale = 0.94 + 0.06 * heroSpring;

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 80px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          transform: `scale(${heroScale})`,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 12,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: COLORS.accent,
            backgroundColor: COLORS.raised,
            padding: '4px 12px',
            borderRadius: 2,
            border: `1px solid ${COLORS.line}`,
          }}
        >
          CORE FINANCIAL INFRASTRUCTURE
        </div>

        <h1
          style={{
            fontSize: 40,
            fontWeight: 600,
            color: COLORS.ink,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            margin: 0,
          }}
        >
          Ledgerly
        </h1>

        <div
          style={{
            width: 860,
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.line}`,
            borderRadius: 6,
            padding: 24,
            marginTop: 16,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ flex: 1, padding: '0 20px' }}>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 12,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: COLORS.ink2,
                marginBottom: 8,
              }}
            >
              POSTING SPEED
            </div>
            <div
              className="tabular-nums"
              style={{
                fontFamily: FONTS.mono,
                fontSize: 28,
                fontWeight: 600,
                color: COLORS.ink,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              45,000 tx/s
            </div>
          </div>

          <div
            style={{
              flex: 1,
              padding: '0 20px',
              borderLeft: `1px solid ${COLORS.line}`,
            }}
          >
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 12,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: COLORS.ink2,
                marginBottom: 8,
              }}
            >
              SETTLEMENT LATENCY
            </div>
            <div
              className="tabular-nums"
              style={{
                fontFamily: FONTS.mono,
                fontSize: 28,
                fontWeight: 600,
                color: COLORS.accent,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              1.2 ms
            </div>
          </div>

          <div
            style={{
              flex: 1,
              padding: '0 20px',
              borderLeft: `1px solid ${COLORS.line}`,
            }}
          >
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 12,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: COLORS.ink2,
                marginBottom: 8,
              }}
            >
              RECONCILIATION DRIFT
            </div>
            <div
              className="tabular-nums"
              style={{
                fontFamily: FONTS.mono,
                fontSize: 28,
                fontWeight: 600,
                color: COLORS.good,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              0.0000%
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Feature1Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ROW_DELAYS = [6, 22, 41];
  const rows = [
    {
      id: 'TX-89211',
      time: '23:08:12.104',
      debit: '1010-Operating Cash',
      credit: '4010-Enterprise ARR',
      amount: '$142,500.00',
      status: 'POSTED',
    },
    {
      id: 'TX-89212',
      time: '23:08:12.189',
      debit: '1050-Stripe Clearing',
      credit: '4020-Usage Revenue',
      amount: '$63,180.00',
      status: 'POSTED',
    },
    {
      id: 'TX-89213',
      time: '23:08:12.245',
      debit: '2010-Payables Clearing',
      credit: '1020-FedNow Reserve',
      amount: '$18,240.50',
      status: 'POSTED',
    },
  ];

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 80px',
      }}
    >
      <div
        style={{
          width: 1320,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 12,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: COLORS.accent,
            }}
          >
            FEATURE 01
          </span>
          <h2
            style={{
              fontSize: 40,
              fontWeight: 600,
              color: COLORS.ink,
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            Real-Time Double-Entry Engine
          </h2>
        </div>

        <div
          style={{
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.line}`,
            borderRadius: 6,
            padding: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: 16,
              borderBottom: `1px solid ${COLORS.line}`,
              fontFamily: FONTS.mono,
              fontSize: 12,
            }}
          >
            <span style={{ color: COLORS.ink2 }}>
              INVARIANT BALANCE: Σ DEBITS == Σ CREDITS
            </span>
            <span style={{ color: COLORS.good, fontWeight: 600 }}>
              INVARIANT VALIDATED: 0.00 VARIANCE
            </span>
          </div>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: FONTS.mono,
              fontSize: 14,
              marginTop: 16,
            }}
          >
            <thead>
              <tr style={{ color: COLORS.ink2, textAlign: 'left' }}>
                <th style={{ padding: '8px 12px' }}>ENTRY ID</th>
                <th style={{ padding: '8px 12px' }}>TIMESTAMP</th>
                <th style={{ padding: '8px 12px' }}>DEBIT ACCOUNT</th>
                <th style={{ padding: '8px 12px' }}>CREDIT ACCOUNT</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>AMOUNT</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const rowSpring = spring({
                  frame: frame - ROW_DELAYS[index],
                  fps,
                  config: { damping: 200, overshootClamping: true },
                });
                const translateY = (1 - rowSpring) * 12;

                return (
                  <tr
                    key={row.id}
                    style={{
                      borderTop: `1px solid ${COLORS.line}`,
                      transform: `translateY(${translateY}px)`,
                      color: COLORS.ink,
                    }}
                  >
                    <td style={{ padding: '12px', color: COLORS.accent }}>{row.id}</td>
                    <td style={{ padding: '12px' }} className="tabular-nums">{row.time}</td>
                    <td style={{ padding: '12px' }}>{row.debit}</td>
                    <td style={{ padding: '12px' }}>{row.credit}</td>
                    <td
                      style={{
                        padding: '12px',
                        textAlign: 'right',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                      className="tabular-nums"
                    >
                      {row.amount}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: COLORS.good }}>
                      {row.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: `1px solid ${COLORS.line}`,
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: FONTS.mono,
              fontSize: 12,
              color: COLORS.ink2,
            }}
          >
            <span>
              TOTAL POSTED:{' '}
              <strong className="tabular-nums" style={{ color: COLORS.ink }}>
                $223,920.50
              </strong>
            </span>
            <span>
              POST LATENCY:{' '}
              <strong className="tabular-nums" style={{ color: COLORS.ink }}>
                0.88 ms
              </strong>
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Feature2Scene: React.FC = () => {
  const frame = useCurrentFrame();

  const matchRate = interpolate(frame, [12, 55], [99.2, 100.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const unmatchedCount = interpolate(frame, [12, 55], [14, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const isComplete = frame >= 55;

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 80px',
      }}
    >
      <div
        style={{
          width: 1320,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 12,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: COLORS.accent,
            }}
          >
            FEATURE 02
          </span>
          <h2
            style={{
              fontSize: 40,
              fontWeight: 600,
              color: COLORS.ink,
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            Continuous Multi-Bank Reconciliation
          </h2>
        </div>

        <div
          style={{
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.line}`,
            borderRadius: 6,
            padding: 32,
            display: 'flex',
            gap: 32,
          }}
        >
          <div style={{ flex: 1.4, display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 12,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: COLORS.ink2,
                paddingBottom: 16,
                borderBottom: `1px solid ${COLORS.line}`,
              }}
            >
              BANK SETTLEMENT FEEDS
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 0',
                  borderBottom: `1px solid ${COLORS.line}`,
                }}
              >
                <div>
                  <div style={{ color: COLORS.ink, fontWeight: 500, fontSize: 16 }}>
                    FedNow Real-Time Settlement
                  </div>
                  <div style={{ color: COLORS.ink2, fontFamily: FONTS.mono, fontSize: 12, marginTop: 4 }}>
                    Protocol ISO 20022 · Direct Gateway
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="tabular-nums" style={{ fontFamily: FONTS.mono, fontSize: 14, color: COLORS.ink }}>
                    1,420 matched
                  </div>
                  <div style={{ color: COLORS.good, fontFamily: FONTS.mono, fontSize: 12, marginTop: 4 }}>
                    SYNCHRONIZED
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 0',
                  borderBottom: `1px solid ${COLORS.line}`,
                }}
              >
                <div>
                  <div style={{ color: COLORS.ink, fontWeight: 500, fontSize: 16 }}>
                    JPMorgan Chase Clearing
                  </div>
                  <div style={{ color: COLORS.ink2, fontFamily: FONTS.mono, fontSize: 12, marginTop: 4 }}>
                    EBICS 3.0 / CAMT.053 Feed
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="tabular-nums" style={{ fontFamily: FONTS.mono, fontSize: 14, color: COLORS.ink }}>
                    4,819 matched
                  </div>
                  <div style={{ color: COLORS.good, fontFamily: FONTS.mono, fontSize: 12, marginTop: 4 }}>
                    SYNCHRONIZED
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 0',
                }}
              >
                <div>
                  <div style={{ color: COLORS.ink, fontWeight: 500, fontSize: 16 }}>
                    Stripe Treasury Account
                  </div>
                  <div style={{ color: COLORS.ink2, fontFamily: FONTS.mono, fontSize: 12, marginTop: 4 }}>
                    Real-Time Balance Bridge
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="tabular-nums" style={{ fontFamily: FONTS.mono, fontSize: 14, color: COLORS.ink }}>
                    9,215 matched
                  </div>
                  <div style={{ color: COLORS.good, fontFamily: FONTS.mono, fontSize: 12, marginTop: 4 }}>
                    SYNCHRONIZED
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              borderLeft: `1px solid ${COLORS.line}`,
              paddingLeft: 32,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 12,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: COLORS.ink2,
                marginBottom: 8,
              }}
            >
              MATCH RESOLUTION RATE
            </div>

            <div
              className="tabular-nums"
              style={{
                fontFamily: FONTS.mono,
                fontSize: 40,
                fontWeight: 600,
                color: isComplete ? COLORS.good : COLORS.ink,
                fontVariantNumeric: 'tabular-nums',
                marginBottom: 16,
              }}
            >
              {matchRate.toFixed(1)}%
            </div>

            <div
              style={{
                height: 8,
                backgroundColor: COLORS.raised,
                borderRadius: 2,
                overflow: 'hidden',
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${matchRate}%`,
                  backgroundColor: isComplete ? COLORS.good : COLORS.accent,
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: FONTS.mono,
                fontSize: 12,
                color: COLORS.ink2,
              }}
            >
              <span>UNMATCHED RECORDS</span>
              <span
                className="tabular-nums"
                style={{
                  color: isComplete ? COLORS.good : COLORS.warn,
                  fontWeight: 600,
                }}
              >
                {Math.round(unmatchedCount)} PENDING
              </span>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Feature3Scene: React.FC = () => {
  const frame = useCurrentFrame();

  const progress = interpolate(frame, [8, 60], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const isVerified = frame >= 60;

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 80px',
      }}
    >
      <div
        style={{
          width: 1320,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 12,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: COLORS.accent,
            }}
          >
            FEATURE 03
          </span>
          <h2
            style={{
              fontSize: 40,
              fontWeight: 600,
              color: COLORS.ink,
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            Cryptographic Sub-Ledger Audit Trail
          </h2>
        </div>

        <div
          style={{
            backgroundColor: COLORS.surface,
            border: `1px solid ${COLORS.line}`,
            borderRadius: 6,
            padding: 32,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: 20,
              borderBottom: `1px solid ${COLORS.line}`,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: COLORS.ink2,
                }}
              >
                MERKLE BLOCK HEADER
              </div>
              <div
                className="tabular-nums"
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 20,
                  fontWeight: 600,
                  color: COLORS.ink,
                  marginTop: 6,
                }}
              >
                BLOCK HEIGHT #1,849,204
              </div>
            </div>

            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 12,
                padding: '6px 14px',
                borderRadius: 2,
                backgroundColor: isVerified ? COLORS.accent : COLORS.raised,
                color: isVerified ? COLORS.onAccent : COLORS.ink2,
                fontWeight: 600,
              }}
            >
              {isVerified ? 'VERIFIED IMMUTABLE' : 'VERIFYING SIGNATURES'}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              padding: '24px 0',
              fontFamily: FONTS.mono,
              fontSize: 14,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: COLORS.ink2 }}>MERKLE ROOT HASH</span>
              <span style={{ color: COLORS.ink }} className="tabular-nums">
                sha256:4a8f93e2b1008d5c7f8a9e4d6c2b1a3e
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: COLORS.ink2 }}>CHAIN INTEGRITY CHECK</span>
              <span style={{ color: COLORS.good, fontWeight: 500 }}>
                1,849,204 BLOCKS AUDITED · ZERO DRIFT
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: COLORS.ink2 }}>REGULATORY EXPORT</span>
              <span style={{ color: COLORS.ink }}>
                SOC-1 TYPE II / ISO 27001 READY
              </span>
            </div>
          </div>

          <div
            style={{
              height: 4,
              backgroundColor: COLORS.raised,
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                backgroundColor: COLORS.accent,
              }}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ctaSpring = spring({
    frame,
    fps,
    config: { damping: 200, overshootClamping: true },
  });

  const buttonActive = frame >= 25;

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 80px',
      }}
    >
      <div
        style={{
          width: 960,
          backgroundColor: COLORS.surface,
          border: `1px solid ${COLORS.line}`,
          borderRadius: 6,
          padding: 48,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
          transform: `scale(${0.95 + 0.05 * ctaSpring})`,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: COLORS.accent,
          }}
        >
          LEDGERLY
        </div>

        <h2
          style={{
            fontSize: 40,
            fontWeight: 600,
            color: COLORS.ink,
            lineHeight: 1.15,
            textAlign: 'center',
            margin: 0,
          }}
        >
          Close financial periods in seconds.
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            style={{
              height: 40,
              padding: '0 24px',
              backgroundColor: buttonActive ? COLORS.ink : COLORS.accent,
              color: COLORS.onAccent,
              border: 'none',
              borderRadius: 6,
              fontFamily: FONTS.body,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Start 14-day production trial
          </button>

          <div
            style={{
              height: 40,
              padding: '0 20px',
              backgroundColor: 'transparent',
              border: `1px solid ${COLORS.line}`,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              fontFamily: FONTS.mono,
              fontSize: 14,
              color: COLORS.ink,
            }}
          >
            ledgerly.io/deploy
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Launch: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        fontFamily: FONTS.body,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-variant-numeric: tabular-nums;
        }
      `}</style>

      {/* Header Telemetry bar */}
      <HeaderShell />

      {/* Background Track */}
      <Audio
        src={staticFile('music.mp3')}
        volume={(f) =>
          interpolate(f, [0, 25, 420, 450], [0, 0.28, 0.28, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        }
      />

      {/* SFX: Whoosh into Feature 1 */}
      <Sequence from={72} durationInFrames={28}>
        <Audio src={staticFile('sfx/whoosh.mp3')} volume={0.22} />
      </Sequence>

      {/* SFX: Pop on 100% Reconciliation match */}
      <Sequence from={240} durationInFrames={24}>
        <Audio src={staticFile('sfx/pop.mp3')} volume={0.18} />
      </Sequence>

      {/* SFX: Riser building into CTA */}
      <Sequence from={345} durationInFrames={39}>
        <Audio src={staticFile('sfx/riser.mp3')} volume={0.20} />
      </Sequence>

      {/* SFX: Click on CTA button action */}
      <Sequence from={410} durationInFrames={21}>
        <Audio src={staticFile('sfx/click.mp3')} volume={0.22} />
      </Sequence>

      {/* Visual Scenes */}
      <Sequence from={0} durationInFrames={75}>
        <IntroScene />
      </Sequence>

      <Sequence from={75} durationInFrames={110}>
        <Feature1Scene />
      </Sequence>

      <Sequence from={185} durationInFrames={105}>
        <Feature2Scene />
      </Sequence>

      <Sequence from={290} durationInFrames={95}>
        <Feature3Scene />
      </Sequence>

      <Sequence from={385} durationInFrames={65}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
};

export default Launch;
