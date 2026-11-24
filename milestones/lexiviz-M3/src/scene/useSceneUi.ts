import { useSyncExternalStore } from 'react';
import { getSceneUi, subscribeSceneUi } from './sceneStore';

export const useSceneUi = () => useSyncExternalStore(subscribeSceneUi, getSceneUi);
