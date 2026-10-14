import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';

const customers = ['Northwind', 'Contoso', 'Fabrikam', 'Tailspin', 'Wingtip', 'Litware', 'Proseware', 'Adatum'];

export const LogoWall = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill className="logos">
      {customers.map((name, i) => {
        const shown = interpolate(frame - i * 6, [0, 12], [0.4, 1], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return <img key={name} src={`/logos/${name}.svg`} alt={name} style={{ opacity: shown }} />;
      })}
    </AbsoluteFill>
  );
};
