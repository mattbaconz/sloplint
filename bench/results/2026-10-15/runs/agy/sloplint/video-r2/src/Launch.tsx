import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  Sequence,
  Series,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import './style.css';

const TRANSACTIONS = [
  { time: '09:41:02', inst: 'SILICON VALLEY BANK', acct: 'OPERATING #4829', amount: '+$240,000.00' },
  { time: '09:41:18', inst: 'STRIPE PAYMENTS US', acct: 'PAYOUTS #1042', amount: '+$18,450.20' },
  { time: '09:41:35', inst: 'JPMORGAN CHASE', acct: 'TREASURY #9001', amount: '-$45,000.00' },
];

const EXPORT_FORMATS = [
  'QUICKBOOKS ONLINE',
  'XERO CLOUD',
  'NETSUITE ERP',
  'GAAP JOURNAL (CSV)',
  'IRS 1099 COMPLIANT',
  'IFRS CONSOLIDATION',
];

const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const heroScale = interpolate(frame, [0, 36], [0.93, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateRight: 'clamp',
  });

  const taglineClip = interpolate(frame, [12, 42], [100, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const kickerSettle = spring({ frame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 96px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid var(--line)',
          paddingBottom: '24px',
          fontFamily: 'var(--font-mono)',
          fontSize: '22px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          transform: `translateY(${(1 - kickerSettle) * -16}px)`,
        }}
      >
        <span>LEDGERLY // CORE ENGINE</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--accent)' }}>
          SYSTEM ACTIVE · 2026.10
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '28px',
          transform: `scale(${heroScale})`,
          transformOrigin: 'left center',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '150px',
            fontWeight: 700,
            lineHeight: 1.0,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            color: 'var(--ink)',
          }}
        >
          LEDGERLY
        </div>

        <div
          style={{
            height: '2px',
            width: '100%',
            backgroundColor: 'var(--line)',
          }}
        />

        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '54px',
            fontWeight: 700,
            lineHeight: 1.1,
            textTransform: 'uppercase',
            color: 'var(--accent)',
            clipPath: `inset(0 ${taglineClip}% 0 0)`,
          }}
        >
          ACCOUNTING THAT RECONCILES ITSELF
        </div>
      </div>

      <div
        style={{
          borderTop: '2px solid var(--line)',
          paddingTop: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: '20px',
        }}
      >
        <span>REAL-TIME TRANSACTION VERIFICATION</span>
        <span
          style={{
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--ok)',
            fontWeight: 500,
          }}
        >
          [ 0 UNBALANCED LEDGER ENTRIES ]
        </span>
      </div>
    </AbsoluteFill>
  );
};

const BankSyncScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleSlide = interpolate(frame, [0, 24], [-24, 0], {
    easing: Easing.out(Easing.quad),
    extrapolateRight: 'clamp',
  });

  const institutionCount = Math.round(
    interpolate(frame, [10, 58], [1200, 11420], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  const ease = Easing.out(Easing.quad);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 96px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid var(--line)',
          paddingBottom: '24px',
          transform: `translateY(${titleSlide}px)`,
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', textTransform: 'uppercase' }}>
          KEY FEATURE 01 // DATA PIPELINE
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '22px',
            color: 'var(--ok)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          LIVE FEED ONLINE
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '56px',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--ink)',
            lineHeight: 1.1,
          }}
        >
          DIRECT BANK FEED SYNC
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '32px' }}>
          <div
            className="tabular-nums"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '130px',
              fontWeight: 700,
              color: 'var(--accent)',
              lineHeight: 1.0,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {institutionCount.toLocaleString()}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '38px',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--ink)',
              letterSpacing: '0.02em',
            }}
          >
            INSTITUTIONS CONNECTED IN REAL TIME
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '2px solid var(--line)',
            width: '100%',
          }}
        >
          {TRANSACTIONS.map((row, i) => {
            const start = Math.round(ease(i / (TRANSACTIONS.length - 1)) * 16);
            const rowOffset = interpolate(frame - start, [4, 22], [40, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            return (
              <div
                key={row.acct}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '160px 1fr 1fr 240px 160px',
                  padding: '20px 28px',
                  alignItems: 'center',
                  borderBottom: i < TRANSACTIONS.length - 1 ? '1px solid var(--line)' : 'none',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '20px',
                  transform: `translateX(${rowOffset}px)`,
                }}
              >
                <span style={{ color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>{row.time}</span>
                <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{row.inst}</span>
                <span style={{ color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>{row.acct}</span>
                <span style={{ color: 'var(--ink)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {row.amount}
                </span>
                <span style={{ color: 'var(--ok)', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  MATCHED
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          borderTop: '2px solid var(--line)',
          paddingTop: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)',
          fontSize: '18px',
          color: 'var(--ink-2)',
        }}
      >
        <span>CONTINUOUS SYNC ACROSS CHECKING, SAVINGS AND CARDS</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>LATENCY &lt; 250MS</span>
      </div>
    </AbsoluteFill>
  );
};

const ReceiptOcrScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleSlide = interpolate(frame, [0, 24], [-24, 0], {
    easing: Easing.out(Easing.quad),
    extrapolateRight: 'clamp',
  });

  const scanBeamY = interpolate(frame, [8, 54], [0, 100], {
    extrapolateRight: 'clamp',
  });

  const matchAccuracy = interpolate(frame, [14, 46], [82.4, 99.2], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const badgeScale = interpolate(frame, [36, 58], [0.86, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 96px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid var(--line)',
          paddingBottom: '24px',
          transform: `translateY(${titleSlide}px)`,
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', textTransform: 'uppercase' }}>
          KEY FEATURE 02 // DOCUMENT VISION
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '22px',
            color: 'var(--accent)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          OCR INGESTION ACTIVE
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '56px',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--ink)',
            lineHeight: 1.1,
          }}
        >
          INSTANT RECEIPT OCR MATCHING
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '36px' }}>
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '2px solid var(--line)',
              padding: '36px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${scanBeamY}%`,
                height: '3px',
                backgroundColor: 'var(--accent)',
              }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)',
                fontSize: '18px',
                color: 'var(--ink-2)',
              }}
            >
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>DOC #INV-2026-881</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>2026-10-14</span>
            </div>

            <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 700, color: 'var(--ink)' }}>
              AMAZON WEB SERVICES LLC
            </div>

            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '20px',
                color: 'var(--ink)',
                borderTop: '1px solid var(--line)',
                paddingTop: '16px',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>CLOUD INFRASTRUCTURE US-EAST</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>$4,820.00</span>
            </div>

            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--accent)',
                borderTop: '1px solid var(--line)',
                paddingTop: '16px',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>TOTAL BILLED</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>$4,820.00</span>
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '2px solid var(--line)',
              padding: '36px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '18px',
                  color: 'var(--ink-2)',
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                }}
              >
                AUTOMATIC MATCH ACCURACY
              </div>
              <div
                className="tabular-nums"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '96px',
                  fontWeight: 700,
                  color: 'var(--accent)',
                  lineHeight: 1.0,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {matchAccuracy.toFixed(1)}%
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '20px',
                  color: 'var(--ink)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                PARSED IN 1.4 SECONDS // 0 MANUAL KEYS
              </div>

              <div
                style={{
                  backgroundColor: 'var(--surface-2)',
                  border: '2px solid var(--ok)',
                  color: 'var(--ok)',
                  padding: '16px 24px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '20px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  transform: `scale(${badgeScale})`,
                  transformOrigin: 'left center',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                VERIFIED TO BANK DEBIT #7719
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          borderTop: '2px solid var(--line)',
          paddingTop: '20px',
          fontFamily: 'var(--font-mono)',
          fontSize: '18px',
          color: 'var(--ink-2)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>LINE-ITEM EXTRACTION WITH TAX & CURRENCY NORMALIZATION</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>OCR LATENCY 1.4S</span>
      </div>
    </AbsoluteFill>
  );
};

const JournalExportsScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleSlide = interpolate(frame, [0, 24], [-24, 0], {
    easing: Easing.out(Easing.quad),
    extrapolateRight: 'clamp',
  });

  const ease = Easing.out(Easing.quad);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 96px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid var(--line)',
          paddingBottom: '24px',
          transform: `translateY(${titleSlide}px)`,
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', textTransform: 'uppercase' }}>
          KEY FEATURE 03 // REPORTING & SYNC
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '22px',
            color: 'var(--ok)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          EXPORT PIPELINE READY
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '56px',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--ink)',
            lineHeight: 1.1,
          }}
        >
          AUDIT-READY JOURNAL EXPORTS
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '32px' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '130px',
              fontWeight: 700,
              color: 'var(--accent)',
              lineHeight: 1.0,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            12
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '38px',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--ink)',
              letterSpacing: '0.02em',
            }}
          >
            NATIVE EXPORT FORMATS FOR TAX AND LEDGER COMPLIANCE
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px',
          }}
        >
          {EXPORT_FORMATS.map((fmt, i) => {
            const start = Math.round(ease(i / (EXPORT_FORMATS.length - 1)) * 18);
            const itemOffset = interpolate(frame - start, [5, 22], [24, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            return (
              <div
                key={fmt}
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '2px solid var(--line)',
                  padding: '24px 28px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '20px',
                  fontWeight: 500,
                  color: 'var(--ink)',
                  textTransform: 'uppercase',
                  transform: `translateY(${itemOffset}px)`,
                }}
              >
                {fmt}
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          borderTop: '2px solid var(--line)',
          paddingTop: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: '18px',
          color: 'var(--ink)',
        }}
      >
        <span>Reconciled over $420M in transactions in Q3 2026 (Ledgerly Ledger Index)</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ok)' }}>AUDIT CERTIFIED</span>
      </div>
    </AbsoluteFill>
  );
};

const CtaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({ frame, fps, config: { damping: 200 } });
  const buttonSpring = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const isClicked = frame >= 45 && frame <= 52;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'var(--accent)',
        color: 'var(--on-accent)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '80px 108px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid var(--on-accent)',
          paddingBottom: '24px',
          fontFamily: 'var(--font-mono)',
          fontSize: '22px',
          fontWeight: 500,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        <span>LEDGERLY // INSTANT ONBOARDING</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>PRODUCTION READY // 2026</span>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '24px',
          transform: `translateY(${(1 - titleSpring) * 28}px)`,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '150px',
            fontWeight: 700,
            lineHeight: 1.0,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            color: 'var(--on-accent)',
          }}
        >
          LEDGERLY
        </div>

        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '52px',
            fontWeight: 700,
            textTransform: 'uppercase',
            lineHeight: 1.1,
            color: 'var(--on-accent)',
          }}
        >
          CLOSE COMPANY ACCOUNTS IN MINUTES
        </div>

        <div
          style={{
            marginTop: '20px',
            backgroundColor: isClicked ? 'var(--accent)' : 'var(--on-accent)',
            color: isClicked ? 'var(--on-accent)' : 'var(--accent)',
            border: '2px solid var(--on-accent)',
            padding: '24px 56px',
            fontFamily: 'var(--font-display)',
            fontSize: '32px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            cursor: 'pointer',
            transform: `scale(${buttonSpring})`,
            transformOrigin: 'left center',
          }}
        >
          START 14-DAY TRIAL
        </div>
      </div>

      <div
        style={{
          borderTop: '2px solid var(--on-accent)',
          paddingTop: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: '26px',
          fontWeight: 500,
        }}
      >
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>APP.LEDGERLY.COM</span>
        <span>AUDIT-READY FINANCES FROM DAY ONE</span>
      </div>
    </AbsoluteFill>
  );
};

export const Launch: React.FC = () => {
  return (
    <AbsoluteFill
      className="tabular-nums"
      style={{
        backgroundColor: 'var(--bg)',
        color: 'var(--ink)',
        fontFamily: 'var(--font-text)',
      }}
    >
      <style>{`* { font-variant-numeric: tabular-nums; } .tabular-nums { font-variant-numeric: tabular-nums; }`}</style>
      <Audio src={staticFile('music.mp3')} volume={0.28} />
      <Sequence from={15} durationInFrames={60}>
        <Audio src={staticFile('sfx/riser.mp3')} volume={0.20} />
      </Sequence>
      <Sequence from={75} durationInFrames={30}>
        <Audio src={staticFile('sfx/whoosh.mp3')} volume={0.16} />
      </Sequence>
      <Sequence from={215} durationInFrames={30}>
        <Audio src={staticFile('sfx/pop.mp3')} volume={0.22} />
      </Sequence>
      <Sequence from={405} durationInFrames={30}>
        <Audio src={staticFile('sfx/click.mp3')} volume={0.24} />
      </Sequence>

      <Series>
        <Series.Sequence durationInFrames={75}>
          <HookScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={105}>
          <BankSyncScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={95}>
          <ReceiptOcrScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={85}>
          <JournalExportsScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={90}>
          <CtaScene />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

export default Launch;
