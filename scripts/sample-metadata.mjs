import { readFile, writeFile } from "fs/promises";
import path from "path";

const keyId = process.env.B2_KEY_ID;
const applicationKey = process.env.B2_APPLICATION_KEY;
const bucketName = process.env.B2_BUCKET_NAME;

if (!keyId || !applicationKey || !bucketName) {
  throw new Error(
    "Missing B2 env vars: B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME"
  );
}

const indexPath = path.join(process.cwd(), "data", "tracks-index.json");
const indexRaw = await readFile(indexPath, "utf-8");
const index = JSON.parse(indexRaw);

const withLyrics = index.tracks.filter(
  (track) => track.lyrics && track.lyrics.sections?.length
);

const sampleSize = Math.min(5, withLyrics.length);
const samples = [];

while (samples.length < sampleSize) {
  const pick = withLyrics[Math.floor(Math.random() * withLyrics.length)];
  if (!samples.find((item) => item.id === pick.id)) {
    samples.push(pick);
  }
}

const auth = Buffer.from(`${keyId}:${applicationKey}`).toString("base64");
const authResponse = await fetch(
  "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
  {
    headers: {
      Authorization: `Basic ${auth}`
    }
  }
);

if (!authResponse.ok) {
  throw new Error(await authResponse.text());
}

const authData = await authResponse.json();
const downloadUrl = authData.downloadUrl;
const accountToken = authData.authorizationToken;

function encodePath(fileName) {
  return fileName
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function downloadMetadata(fileName) {
  const response = await fetch(
    `${downloadUrl}/file/${bucketName}/${encodePath(fileName)}`,
    {
      headers: {
        Authorization: accountToken
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to download ${fileName}`);
  }

  return response.text();
}

for (let i = 0; i < samples.length; i += 1) {
  const track = samples[i];
  const baseName = track.b2FileName
    .replace(/^mp3\//, "")
    .replace(/\.mp3$/i, "");
  const metadataName = `metadata/${baseName}.json`;
  const json = await downloadMetadata(metadataName);
  const outputPath = path.join(
    process.cwd(),
    "data",
    "samples",
    `sample-${i + 1}.json`
  );
  await writeFile(outputPath, json);
}

console.log(`Saved ${samples.length} samples to data/samples.`);
