import React from "react";
import { Composition } from "remotion";
import { Launch, LAUNCH_DURATION } from "./Launch";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Launch"
      component={Launch}
      durationInFrames={LAUNCH_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
