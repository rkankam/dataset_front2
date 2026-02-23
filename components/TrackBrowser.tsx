"use client";

import { useEffect, useMemo, useState } from "react";
import type { Track } from "@/lib/tracks";
import PlayerBar from "@/components/PlayerBar";

type TrackBrowserProps = {
  tracks: Track[];
};

export default function TrackBrowser({ tracks }: TrackBrowserProps) {
  const [query, setQuery] = useState("");
  const [dateSort, setDateSort] = useState<"desc" | "asc">("desc");
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("home");
  const [shuffleEnabled, setShuffleEnabled] = useState(true);
  const [queue, setQueue] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);
  const [queueOpen, setQueueOpen] = useState(false);

  const queueSize = 5;
  const historySize = 3;

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }),
    []
  );

  const models = useMemo(() => {
    const unique = new Set<string>();
    tracks.forEach((track) => {
      if (track.modelDisplayName) {
        unique.add(track.modelDisplayName);
      }
    });
    return ["all", ...Array.from(unique).sort()];
  }, [tracks]);

  const filteredTracks = useMemo(() => {
    const filtered = tracks.filter((track) => {
      if (!query) return true;
      const haystack = [
        track.title,
        track.modelDisplayName,
        track.sound,
        track.tags.join(" ")
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query.toLowerCase());
    });

    return filtered.sort((a, b) => {
      const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
      return dateSort === "desc" ? bTime - aTime : aTime - bTime;
    });
  }, [tracks, query, dateSort]);

  const pickSequential = (
    list: Track[],
    excludeIds: Set<string>,
    anchor: Track | null
  ) => {
    if (!list.length) return null;
    const anchorIndex = anchor
      ? list.findIndex((track) => track.id === anchor.id)
      : 0;
    for (let offset = 1; offset <= list.length; offset += 1) {
      const index = (anchorIndex + offset + list.length) % list.length;
      const candidate = list[index];
      if (!excludeIds.has(candidate.id)) {
        return candidate;
      }
    }
    return null;
  };

  const pickRandom = (list: Track[], excludeIds: Set<string>) => {
    const pool = list.filter((track) => !excludeIds.has(track.id));
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const extendQueue = (
    existingQueue: Track[],
    list: Track[],
    current: Track | null,
    recentHistory: Track[],
    size: number,
    shuffle: boolean
  ) => {
    if (!current) return existingQueue;
    const nextQueue = existingQueue.slice(0, size);
    const excludeIds = new Set([
      current.id,
      ...recentHistory.map((item) => item.id),
      ...nextQueue.map((item) => item.id)
    ]);

    while (nextQueue.length < size) {
      const anchor = nextQueue.length
        ? nextQueue[nextQueue.length - 1]
        : current;
      const candidate = shuffle
        ? pickRandom(list, excludeIds)
        : pickSequential(list, excludeIds, anchor);
      if (!candidate) break;
      nextQueue.push(candidate);
      excludeIds.add(candidate.id);
    }

    return nextQueue;
  };

  const isSameQueue = (a: Track[], b: Track[]) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i].id !== b[i].id) return false;
    }
    return true;
  };

  const startTrack = async (
    track: Track,
    shouldSeedQueue = true,
    historyOverride?: Track[]
  ) => {
    setIsLoading(true);
    setCurrentTrack(track);
    try {
      const params = new URLSearchParams({ fileName: track.b2FileName });
      setAudioSrc(`/api/b2/stream?${params.toString()}`);
    } catch (error) {
      console.error(error);
      setIsLoading(false);
    }

    if (shouldSeedQueue) {
      const baseQueue = queue.filter((item) => item.id !== track.id);
      setQueue(
        extendQueue(
          baseQueue,
          filteredTracks,
          track,
          historyOverride ?? history,
          queueSize,
          shuffleEnabled
        )
      );
    }
  };

  const handlePlay = async (track: Track) => {
    const nextHistory =
      currentTrack && currentTrack.id !== track.id
        ? [currentTrack, ...history].slice(0, historySize)
        : history;
    setHistory(nextHistory);
    await startTrack(track, true, nextHistory);
  };

  const handleJump = async (track: Track, source: "queue" | "history") => {
    if (!currentTrack || currentTrack.id === track.id) return;
    const nextHistoryBase = [currentTrack, ...history].filter(
      (item) => item.id !== track.id
    );
    const nextHistory = nextHistoryBase.slice(0, historySize);
    setHistory(nextHistory);

    const remainingQueue = queue.filter((item) => item.id !== track.id);
    setQueue(
      extendQueue(remainingQueue, filteredTracks, track, nextHistory, queueSize, shuffleEnabled)
    );

    await startTrack(track, false);
  };

  const handleNext = async () => {
    if (!currentTrack) return;
    const nextHistory = [currentTrack, ...history].slice(0, historySize);
    const nextTrack = queue.length
      ? queue[0]
      : extendQueue([], filteredTracks, currentTrack, nextHistory, 1, shuffleEnabled)[0];
    if (!nextTrack) return;
    const trimmedQueue = queue.length ? queue.slice(1) : [];
    setHistory(nextHistory);
    setQueue(
      extendQueue(trimmedQueue, filteredTracks, nextTrack, nextHistory, queueSize, shuffleEnabled)
    );
    await startTrack(nextTrack, false);
  };

  const handlePrev = async () => {
    if (!currentTrack || history.length === 0) return;
    const [previous, ...rest] = history;
    const nextQueue = [currentTrack, ...queue.filter((item) => item.id !== currentTrack.id)];
    setHistory(rest);
    setQueue(
      extendQueue(nextQueue, filteredTracks, previous, rest, queueSize, shuffleEnabled)
    );
    await startTrack(previous, false);
  };

  useEffect(() => {
    if (!currentTrack) return;
    const nextQueue = extendQueue(
      queue,
      filteredTracks,
      currentTrack,
      history,
      queueSize,
      shuffleEnabled
    );
    if (!isSameQueue(queue, nextQueue)) {
      setQueue(nextQueue);
    }
  }, [filteredTracks, shuffleEnabled, currentTrack, history, queue]);

  return (
    <div className="page">
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Fermer la navigation"
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">Producer AI</div>
        <div className="nav-group">
          <button
            type="button"
            className={`nav-item ${activeNav === "home" ? "active" : ""}`}
            onClick={() => setActiveNav("home")}
          >
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </span>
            Accueil
          </button>
          <button
            type="button"
            className={`nav-item ${activeNav === "favorites" ? "active" : ""}`}
            onClick={() => setActiveNav("favorites")}
          >
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 20s-6.5-4.2-8.5-7.5C2 9.5 3.8 6 7.5 6c2 0 3.5 1.1 4.5 2.6C13 7.1 14.5 6 16.5 6 20.2 6 22 9.5 20.5 12.5 18.5 15.8 12 20 12 20z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </span>
            Favoris
          </button>
          <button
            type="button"
            className={`nav-item ${activeNav === "playlists" ? "active" : ""}`}
            onClick={() => setActiveNav("playlists")}
          >
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 7h14M5 12h14M5 17h10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            Playlists
          </button>
        </div>
      </aside>

      <section className="main">
        <div className="hero">
          <div className="hero-header">
            <button
              type="button"
              className="nav-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir la navigation"
            >
              Menu
            </button>
            <h1 className="hero-title">Producer AI Dataset</h1>
          </div>
          <p className="hero-subtitle">
            807 tracks synthetiques, metadonnees detaillees, streaming securise
            via B2.
          </p>
          <div className="hero-stats">
            <span className="chip">{tracks.length} tracks</span>
            <span className="chip">Favoris: {tracks.filter((t) => t.isFavorite).length}</span>
            <span className="chip">Modeles: {models.length - 1}</span>
          </div>
        </div>

        <div className="filters">
          <input
            className="input"
            placeholder="Rechercher par titre, vibe, tag..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="table">
          <div className="table-header">
            <span>#</span>
            <span>Titre</span>
            <span className="hide-tablet">Modele</span>
            <span className="hide-mobile">Duree</span>
            <button
              type="button"
              className="sort-button hide-mobile"
              onClick={() => setDateSort(dateSort === "desc" ? "asc" : "desc")}
            >
              Date {dateSort === "desc" ? "↓" : "↑"}
            </button>
          </div>
          {filteredTracks.map((track, index) => (
            <div
              key={track.id}
              className="table-row"
              onClick={() => {
                setSelectedTrack(track);
                handlePlay(track);
              }}
            >
              <span className="track-meta">{index + 1}</span>
              <div>
                <h2 className="track-title">{track.title}</h2>
                <div className="track-meta">
                  {track.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="pill">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <span className="track-meta hide-tablet">
                {track.modelDisplayName || "—"}
              </span>
              <span className="track-meta hide-mobile">
                {track.durationFormatted || "--:--"}
              </span>
              <span className="track-meta hide-mobile">
                {track.createdAt
                  ? dateFormatter.format(new Date(track.createdAt))
                  : ""}
              </span>
            </div>
          ))}
          {filteredTracks.length === 0 && (
            <div className="empty">Aucune track ne correspond.</div>
          )}
        </div>
      </section>

      <aside className="right-panel">
        {selectedTrack ? (
          <div>
            <div className="panel-header">
              <div>
                <h3>Now playing</h3>
                <p>
                  {selectedTrack.title} · {selectedTrack.modelDisplayName || "—"}
                </p>
              </div>
              <button
                type="button"
                className="toggle-button"
                onClick={() => setShowDetails((prev) => !prev)}
                aria-label={showDetails ? "Reduire" : "Voir details"}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="toggle-icon"
                >
                  {showDetails ? (
                    <path
                      d="M6 12h12"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  ) : (
                    <path
                      d="M12 6v12M6 12h12"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  )}
                </svg>
              </button>
            </div>
            {showDetails && (
              <>
                <div style={{ marginTop: 12 }}>
                  <h3>Sound</h3>
                  <p>{selectedTrack.sound || "—"}</p>
                </div>
                <div style={{ marginTop: 12 }}>
                  <h3>Conditions</h3>
                  <p>
                    {selectedTrack.conditions
                      .map((condition) => condition.prompt)
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
                <div style={{ marginTop: 12 }}>
                  <h3>Lyrics</h3>
                  {selectedTrack.lyrics?.sections?.length ? (
                    <div className="lyrics">
                      {selectedTrack.lyrics.sections.map((section) => (
                        <div key={section.section} className="lyrics-section">
                          <strong>{section.section}</strong>
                          <div>
                            {section.content.map((line, lineIndex) => (
                              <div key={`${section.section}-${lineIndex}`}>{line}</div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>Aucune lyrics structuree.</p>
                  )}
                </div>
                <div style={{ marginTop: 12 }}>
                  <h3>Metadata</h3>
                  {renderMetadataBlock("_meta", selectedTrack.meta)}
                  {renderMetadataBlock("apiResponse", selectedTrack.api)}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="empty">Selectionne une track pour voir le detail.</div>
        )}
      </aside>

      <PlayerBar
        track={currentTrack}
        audioSrc={audioSrc}
        isLoading={isLoading}
        onReady={() => setIsLoading(false)}
        onNext={handleNext}
        onPrev={handlePrev}
        onToggleShuffle={() => setShuffleEnabled((prev) => !prev)}
        shuffleEnabled={shuffleEnabled}
        onToggleQueue={() => setQueueOpen((prev) => !prev)}
        queueOpen={queueOpen}
      />

      {queueOpen && (
        <aside className="queue-drawer" aria-label="File d'attente">
          <div className="queue-section">
            <h3>En cours</h3>
            <p>{currentTrack?.title || "-"}</p>
          </div>
          <div className="queue-section">
            <h3>Prochains morceaux</h3>
            {queue.length ? (
              <ul>
                {queue.map((item) => (
                  <li
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleJump(item, "queue")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleJump(item, "queue");
                      }
                    }}
                    className="queue-item"
                  >
                    {item.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p>-</p>
            )}
          </div>
          <div className="queue-section">
            <h3>Historique</h3>
            {history.length ? (
              <ul>
                {history.map((item) => (
                  <li
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleJump(item, "history")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleJump(item, "history");
                      }
                    }}
                    className="queue-item"
                  >
                    {item.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p>-</p>
            )}
          </div>
        </aside>
      )}

    </div>
  );
}
  const renderValue = (value: unknown) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }
    return JSON.stringify(value, null, 2);
  };

  const renderMetadataBlock = (
    label: string,
    data: Record<string, unknown>
  ) => {
    const entries = Object.entries(data).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== null && value !== undefined && value !== "";
    });

    if (entries.length === 0) return null;

    return (
      <div style={{ marginTop: 12 }}>
        <h3>{label}</h3>
        <div className="metadata-list">
          {entries.map(([key, value]) => (
            <div key={key} className="metadata-row">
              <span>{key}</span>
              <pre className="metadata-value">{renderValue(value)}</pre>
            </div>
          ))}
        </div>
      </div>
    );
  };
