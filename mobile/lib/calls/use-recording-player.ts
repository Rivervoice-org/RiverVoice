import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { recordingSource } from "@/lib/calls/recording-source";
import { RecordingVariant, type CallDetail } from "@/lib/calls/types";

export { RecordingVariant };

/**
 * One shared player per screen that shows a recording — `screens/CallDetail`
 * and `screens/Transcript` each own their own instance, released when that
 * screen unmounts, rather than one player surviving navigation.
 *
 * Switching variant resets to 0 rather than trying to preserve position:
 * the two recordings aren't the same length or the same content lined up
 * sample-for-sample, so "keep the same position" wouldn't mean anything
 * consistent across the switch anyway.
 */
export function useRecordingPlayer(call: CallDetail | undefined) {
  const hasTranslated = !!call?.translatedRecordingPath;
  const [variant, setVariant] = useState<RecordingVariant>(
    RecordingVariant.Original,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);

  const path =
    variant === RecordingVariant.Translated && hasTranslated
      ? call?.translatedRecordingPath
      : call?.recordingPath;

  useEffect(() => {
    playerRef.current?.release();
    playerRef.current = null;
    setIsPlaying(false);
    setPositionMs(0);
    setDurationMs(0);
    setLoadFailed(false);

    if (!path) return;
    let cancelled = false;

    recordingSource(path)
      .then((source) => {
        if (cancelled) return;
        const player = createAudioPlayer(source);
        playerRef.current = player;
        player.addListener("playbackStatusUpdate", (status) => {
          setPositionMs(Math.round(status.currentTime * 1000));
          setDurationMs(Math.round(status.duration * 1000));
          if (status.didJustFinish) {
            setIsPlaying(false);
          }
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn("useRecordingPlayer: failed to load recording", error);
        setLoadFailed(true);
      });

    return () => {
      cancelled = true;
      playerRef.current?.release();
      playerRef.current = null;
    };
  }, [path]);

  const toggle = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.playing) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  }, []);

  const seekToMs = useCallback((ms: number) => {
    const player = playerRef.current;
    if (!player) return;
    void player.seekTo(ms / 1000);
    setPositionMs(ms);
    if (!player.playing) {
      player.play();
      setIsPlaying(true);
    }
  }, []);

  return {
    variant,
    setVariant,
    hasTranslated,
    hasAudio: !!path && !loadFailed,
    isPlaying,
    positionMs,
    durationMs,
    toggle,
    seekToMs,
  };
}
