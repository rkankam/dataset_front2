"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import type { Track } from "@/lib/tracks";

type PlayerBarProps = {
  track: Track | null;
  audioSrc: string | null;
  isLoading: boolean;
  onReady?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onToggleShuffle?: () => void;
  shuffleEnabled?: boolean;
  onToggleQueue?: () => void;
  queueOpen?: boolean;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export default function PlayerBar({
  track,
  audioSrc,
  isLoading,
  onReady,
  onNext,
  onPrev,
  onToggleShuffle,
  shuffleEnabled,
  onToggleQueue,
  queueOpen
}: PlayerBarProps) {
  const waveContainerRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const volumePercent = Math.round(volume * 100);

  const waveOptions = useMemo(
    () => ({
      waveColor: "rgba(244, 246, 250, 0.25)",
      progressColor: "#1ed760",
      cursorColor: "#3a86ff",
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      height: 48,
      normalize: true
    }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    const initWave = () => {
      if (cancelled || !waveContainerRef.current) return;
      if (waveContainerRef.current.clientWidth === 0) {
        requestAnimationFrame(initWave);
        return;
      }
      const waveSurfer = WaveSurfer.create({
        container: waveContainerRef.current,
        ...waveOptions
      });

    waveSurfer.on("ready", () => {
      setIsReady(true);
      setDuration(waveSurfer.getDuration());
      setCurrentTime(0);
      waveSurfer.setVolume(volume);
      waveSurfer.play();
      onReady?.();
    });

    waveSurfer.on("audioprocess", () => {
      setCurrentTime(waveSurfer.getCurrentTime());
    });

    waveSurfer.on("play", () => setIsPlaying(true));
    waveSurfer.on("pause", () => setIsPlaying(false));
    waveSurfer.on("finish", () => {
      setIsPlaying(false);
      onNext?.();
    });

      waveSurferRef.current = waveSurfer;
    };

    initWave();

    return () => {
      cancelled = true;
      if (waveSurferRef.current) {
        waveSurferRef.current.destroy();
        waveSurferRef.current = null;
      }
    };
  }, [waveOptions]);

  useEffect(() => {
    const waveSurfer = waveSurferRef.current;
    if (!waveSurfer) return;
    if (!audioSrc) {
      waveSurfer.empty();
      setIsReady(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }
    setIsReady(false);
    waveSurfer.load(audioSrc);
  }, [audioSrc]);


  useEffect(() => {
    const waveSurfer = waveSurferRef.current;
    if (!waveSurfer) return;
    waveSurfer.setVolume(volume);
  }, [volume]);

  const togglePlay = () => {
    const waveSurfer = waveSurferRef.current;
    if (!waveSurfer || !isReady) return;
    waveSurfer.playPause();
  };

  return (
    <div className="player">
      <div className="player-info-line">
        <div className="player-cover">
          <div className="player-cover-fallback">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm8-2V6l-8 2v8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <div className="player-meta">
          <strong>{track?.title || "Aucune track en lecture"}</strong>
          <span>{track?.modelDisplayName || ""}</span>
        </div>
        <button
          type="button"
          className={`player-text-button ${queueOpen ? "active" : ""}`}
          aria-label="File d'attente"
          onClick={onToggleQueue}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 6h16M4 12h10M4 18h6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Queue
        </button>
      </div>
      <div className="player-wave">
        <div className="waveform" ref={waveContainerRef} />
        <div className="player-times">
          <span className="player-time">{formatTime(currentTime)}</span>
          <span className="player-time">{formatTime(duration)}</span>
        </div>
      </div>
      <div className="player-controls-center">
        <button
          type="button"
          className="player-icon-button"
          aria-label="Precedent"
          onClick={onPrev}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6h2v12H6zM18 6l-8 6 8 6V6z" />
          </svg>
        </button>
        <button
          type="button"
          className="player-icon-button player-icon-button--primary"
          onClick={togglePlay}
          disabled={!isReady}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5l11 7-11 7V5z" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="player-icon-button"
          aria-label="Suivant"
          onClick={onNext}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M16 6h2v12h-2zM6 6l8 6-8 6V6z" />
          </svg>
        </button>
        <button
          type="button"
          className={`player-text-button ${shuffleEnabled ? "active" : ""}`}
          aria-label="Lecture aleatoire"
          onClick={onToggleShuffle}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M3 7h4l8 10h4M3 17h4l2-2M17 7h4M17 7l-2-2M17 7l-2 2M21 17l-2-2m2 2-2 2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Shuffle
        </button>
      </div>
      <label className="player-volume">
        <div className="volume-slider">
          <svg viewBox="0 0 100 4" aria-hidden="true">
            <rect x="0" y="0" width="100" height="4" rx="2" />
            <rect
              x="0"
              y="0"
              width={volumePercent}
              height="4"
              rx="2"
              className="volume-progress"
            />
          </svg>
          <span
            className="volume-thumb"
            style={{ left: `calc(${volumePercent}% - 6px)` }}
          />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="Volume"
          />
        </div>
      </label>
    </div>
  );
}
