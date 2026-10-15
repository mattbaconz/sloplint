import { Composition } from "remotion";
import { Launch, LAUNCH_DURATION } from "./Launch";

export const Root: React.FC = () => (
  <Composition
    id="Launch"
    component={Launch}
    durationInFrames={LAUNCH_DURATION}
    fps={30}
    width={1920}
    height={1080}
  />
);
