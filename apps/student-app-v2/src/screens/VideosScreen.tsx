import React from 'react';

import { LessonCollectionScreen } from '../components/learning/LessonCollectionScreen';

export const VideosScreen = () => (
  <LessonCollectionScreen
    kind="video"
    title="Video Library"
    subtitle="Continue lesson videos with a cleaner watch flow and resume-ready progress awareness."
    icon="play-box-multiple-outline"
    accentColor="#dc2626"
  />
);
