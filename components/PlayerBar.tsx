"use client";

import { useEffect, useRef, useState } from "react";
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const volumePercent = Math.round(volume * 100);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audioSrc) {
      setIsReady(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }
    audio.src = audioSrc;
    audio.load();
  }, [audioSrc]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !isReady) return;
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime || 0);
  };

  const handleLoaded = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration || 0);
    setIsReady(true);
    onReady?.();
  };

  const handleEnded = () => {
    setIsPlaying(false);
    onNext?.();
  };

  const handlePlayState = (playing: boolean) => {
    setIsPlaying(playing);
  };

  const handleSeek = (event: React.PointerEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const percent = (event.clientX - bounds.left) / bounds.width;
    audio.currentTime = Math.max(0, Math.min(1, percent)) * duration;
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

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
        <div className="waveform" onPointerDown={handleSeek}>
          <div className="waveform-track" />
          <div className="waveform-progress" style={{ width: `${progressPercent}%` }} />
        </div>
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
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoaded}
        onCanPlay={handleLoaded}
        onPlay={() => handlePlayState(true)}
        onPause={() => handlePlayState(false)}
        onEnded={handleEnded}
      />
    </div>
  );
}
