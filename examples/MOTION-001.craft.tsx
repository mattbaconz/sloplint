import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';

// One element leads: the screenshot grows out of the title card; the copy is simply there on the cut.
export const Intro = () => {
  const frame = useCurrentFrame();
  const grow = interpolate(frame, [0, 24], [0.86, 1], { easing: Easing.bezier(0.2, 0, 0, 1), extrapolateRight: 'clamp' });
  const mask = interpolate(frame, [8, 30], [100, 0], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill className="intro">
      <h1>Ledgerly</h1>
      <p>Invoices that reconcile themselves</p>
      <img src="/app.png" style={{ transform: `scale(${grow})`, clipPath: `inset(0 0 ${mask}% 0)` }} />
      <span>Start a free trial</span>
    </AbsoluteFill>
  );
};
