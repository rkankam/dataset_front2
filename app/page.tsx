import TrackBrowser from "@/components/TrackBrowser";
import { getTracksIndex } from "@/lib/tracks";

export default async function HomePage() {
  const index = await getTracksIndex();

  return (
    <main>
      <TrackBrowser tracks={index.tracks} />
    </main>
  );
}
