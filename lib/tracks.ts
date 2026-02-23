import { readFile } from "fs/promises";
import path from "path";

export type TrackCondition = {
  prompt: string | null;
  lyrics: string | null;
  vibe_input: string | null;
  voice_input: string | null;
  strength: number | null;
  condition_start: number | null;
  condition_end: number | null;
  t_start: number | null;
  t_end: number | null;
};

export type TrackLyricsSection = {
  section: string;
  content: string[];
};

export type TrackLyrics = {
  title?: string;
  language?: string;
  key?: string;
  gender?: string;
  vocal_type?: string;
  timbre?: string;
  age_profile?: string;
  emotion_profile?: string;
  style?: Record<string, string>;
  sections?: TrackLyricsSection[];
};

export type Track = {
  id: string;
  title: string;
  durationSeconds: number | null;
  durationFormatted: string | null;
  isFavorite: boolean;
  modelDisplayName: string | null;
  playCount: number | null;
  createdAt: string | null;
  seed: number | null;
  sound: string | null;
  conditions: TrackCondition[];
  lyrics: TrackLyrics | null;
  meta: Record<string, unknown>;
  api: Record<string, unknown>;
  b2FileName: string;
  imageUrl: string | null;
  tags: string[];
};

export type TrackIndex = {
  generatedAt: string;
  trackCount: number;
  tracks: Track[];
};

export async function getTracksIndex(): Promise<TrackIndex> {
  const filePath = path.join(process.cwd(), "data", "tracks-index.json");
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as TrackIndex;
}
