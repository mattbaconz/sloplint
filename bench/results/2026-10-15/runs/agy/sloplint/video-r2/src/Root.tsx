import React from 'react';
import { Composition } from 'remotion';
import { Launch } from './Launch';

export const Root: React.FC = () => {
  return (
    <Composition
      id="Launch"
      component={Launch}
      durationInFrames={450}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};

export default Root;
