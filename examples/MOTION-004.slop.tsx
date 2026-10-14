import { Series } from 'remotion';
import { Hook, Problem, Demo, Proof, Logo } from './scenes';

export const Launch = () => (
  <Series>
    <Series.Sequence durationInFrames={90}><Hook /></Series.Sequence>
    <Series.Sequence durationInFrames={90}><Problem /></Series.Sequence>
    <Series.Sequence durationInFrames={90}><Demo /></Series.Sequence>
    <Series.Sequence durationInFrames={90}><Proof /></Series.Sequence>
    <Series.Sequence durationInFrames={90}><Logo /></Series.Sequence>
  </Series>
);
