import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';

const customers = ['Northwind', 'Contoso', 'Fabrikam', 'Tailspin', 'Wingtip', 'Litware', 'Proseware', 'Adatum'];
const WINDOW = 18;
const ease = Easing.out(Easing.quad);

// The whole wall lands inside 18 frames: early logos spread out, late ones bunch up.
export const LogoWall = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill className="logos">
      {customers.map((name, i) => {
        const start = Math.round(ease(i / (customers.length - 1)) * WINDOW);
        const shown = interpolate(frame - start, [0, 12], [0.4, 1], { easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return <img key={name} src={`/logos/${name}.svg`} alt={name} style={{ opacity: shown }} />;
      })}
    </AbsoluteFill>
  );
};
