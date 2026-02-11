import { Composition } from "remotion";
import { ClawbookVideo } from "./ClawbookVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ClawbookVideo"
        component={ClawbookVideo}
        durationInFrames={30 * 95} // 95 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
