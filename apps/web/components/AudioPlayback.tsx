'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';

// Shares ONE <audio> element (owned by ArticleAudioPlayer) between the player
// UI and the transcript: the transcript reads `currentTime` via rAF and drives
// it with `seek`. The context value is intentionally STABLE (ref + memoised
// `seek` never change identity) so consumers don't re-render as time advances.

type AudioPlaybackValue = {
  audioRef: RefObject<HTMLAudioElement | null>;
  seek: (seconds: number, opts?: { play?: boolean }) => void;
};

const AudioPlaybackContext = createContext<AudioPlaybackValue | null>(null);

export function AudioPlaybackProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const seek = useCallback((seconds: number, opts?: { play?: boolean }) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    if (opts?.play !== false) void audio.play();
  }, []);

  const value = useMemo<AudioPlaybackValue>(() => ({ audioRef, seek }), [seek]);

  return (
    <AudioPlaybackContext.Provider value={value}>{children}</AudioPlaybackContext.Provider>
  );
}

/** Returns the shared playback handle, or null when used outside a provider. */
export function useAudioPlayback(): AudioPlaybackValue | null {
  return useContext(AudioPlaybackContext);
}
