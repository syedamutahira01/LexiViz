import data from './lessons.json';
import type { Lesson, LessonStage, NarrationCue } from './types';

export const LESSONS: Lesson[] = data.lessons as Lesson[];
export const allStages = (): LessonStage[] => LESSONS.flatMap((l) => l.stages);
export const findStage = (id: string): LessonStage | undefined => allStages().find((s) => s.id === id);
export const resultCue = (stageId: string): NarrationCue | undefined =>
  findStage(stageId)?.cues.find((c) => 'stage' in c.trigger);
