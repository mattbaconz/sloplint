import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

export const Intro = () => {
  const frame = useCurrentFrame();
  const title = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const subtitle = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: 'clamp' });
  const screenshot = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: 'clamp' });
  const button = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill className="intro">
      <h1 style={{ opacity: title }}>Ledgerly</h1>
      <p style={{ opacity: subtitle }}>Invoices that reconcile themselves</p>
      <img src="/app.png" style={{ opacity: screenshot }} />
      <span style={{ opacity: button }}>Start a free trial</span>
    </AbsoluteFill>
  );
};
