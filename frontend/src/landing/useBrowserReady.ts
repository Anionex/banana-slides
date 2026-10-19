import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
// Hydration starts with the same snapshot as the static HTML. Client-only mounts
// (such as the in-place detail transition) can use browser state immediately.
export function useBrowserReady() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
