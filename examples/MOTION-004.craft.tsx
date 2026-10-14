import { Series } from 'remotion';
import { Hook, Problem, Demo, Proof, Logo } from './scenes';

// Cut to the content and the music (120 BPM at 30 fps: one beat is 15 frames).
export const Launch = () => (
  <Series>
    <Series.Sequence durationInFrames={45}><Hook /></Series.Sequence>
    <Series.Sequence durationInFrames={60}><Problem /></Series.Sequence>
    <Series.Sequence durationInFrames={210}><Demo /></Series.Sequence>
    <Series.Sequence durationInFrames={75}><Proof /></Series.Sequence>
    <Series.Sequence durationInFrames={30}><Logo /></Series.Sequence>
  </Series>
);
