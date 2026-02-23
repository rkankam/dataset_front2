import { writeFile, mkdir } from "fs/promises";
import path from "path";

const keyId = process.env.B2_KEY_ID;
const applicationKey = process.env.B2_APPLICATION_KEY;
const bucketId = process.env.B2_BUCKET_ID;
const bucketName = process.env.B2_BUCKET_NAME;

if (!keyId || !applicationKey || !bucketId || !bucketName) {
  throw new Error(
    "Missing B2 env vars: B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_ID, B2_BUCKET_NAME"
  );
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
const apiUrl = authData.apiUrl;
const downloadUrl = authData.downloadUrl;
const accountToken = authData.authorizationToken;

async function listMetadataFiles() {
  const files = [];
  let nextFileName = null;

  do {
    const response = await fetch(`${apiUrl}/b2api/v2/b2_list_file_names`, {
      method: "POST",
      headers: {
        Authorization: accountToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        bucketId,
        prefix: "metadata/",
        startFileName: nextFileName,
        maxFileCount: 1000
      })
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json();
    data.files.forEach((file) => files.push(file.fileName));
    nextFileName = data.nextFileName || null;
  } while (nextFileName);

  return files.filter((name) => name.endsWith(".json"));
}

function encodePath(fileName) {
  return fileName
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function downloadJson(fileName) {
  const encodedName = encodePath(fileName);
  const response = await fetch(
    `${downloadUrl}/file/${bucketName}/${encodedName}`,
    {
      headers: {
        Authorization: accountToken
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to download ${fileName}`);
  }

  return response.json();
}

function safeParseLyrics(lyrics) {
  if (!lyrics || typeof lyrics !== "string") return null;
  try {
    return JSON.parse(lyrics);
  } catch (error) {
    return null;
  }
}

function cleanObject(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => cleanObject(item))
      .filter((item) => item !== null && item !== undefined);
    return cleaned.length ? cleaned : null;
  }
  const entries = Object.entries(value).filter(
    ([, val]) => val !== null && val !== undefined && val !== ""
  );
  if (!entries.length) return null;
  return entries.reduce((acc, [key, val]) => {
    const cleaned = cleanObject(val);
    if (cleaned !== null && cleaned !== undefined && cleaned !== "") {
      acc[key] = cleaned;
    }
    return acc;
  }, {});
}

function normaliseTrack(json) {
  const meta = json._meta || {};
  const api = json.apiResponse || {};
  const filename = meta.filename || "";
  const baseName = filename.replace(/\.wav$/i, "");
  const mp3Name = baseName ? `mp3/${baseName}.mp3` : "";
  const conditions = Array.isArray(api.conditions) ? api.conditions : [];
  const lyricsParsed = safeParseLyrics(api.lyrics);
  const tags = conditions
    .map((condition) => condition.prompt)
    .filter(Boolean)
    .flatMap((prompt) => prompt.split(/,|\n/))
    .map((tag) => tag.trim())
    .filter(Boolean);

  const metaClean = cleanObject(meta) || {};
  const apiClean = cleanObject({
    ...api,
    lyrics: lyricsParsed || api.lyrics || null
  }) || {};

  return {
    id: api.id || baseName,
    title: api.title || baseName,
    durationSeconds: meta.durationSeconds ?? api.duration_s ?? null,
    durationFormatted: meta.durationFormatted || null,
    isFavorite: Boolean(meta.isFavorite || api.is_favorite),
    modelDisplayName: api.model_display_name || null,
    playCount: api.play_count ?? null,
    createdAt: api.created_at || null,
    seed: api.seed ?? null,
    sound: api.sound || null,
    conditions,
    lyrics: lyricsParsed || null,
    meta: metaClean,
    api: apiClean,
    b2FileName: mp3Name,
    imageUrl: api.image_url || null,
    tags
  };
}

const metadataFiles = await listMetadataFiles();
const tracks = [];

for (const fileName of metadataFiles) {
  const json = await downloadJson(fileName);
  tracks.push(normaliseTrack(json));
}

const index = {
  generatedAt: new Date().toISOString(),
  trackCount: tracks.length,
  tracks
};

const outputDir = path.join(process.cwd(), "data");
await mkdir(outputDir, { recursive: true });
await writeFile(
  path.join(outputDir, "tracks-index.json"),
  JSON.stringify(index, null, 2)
);

console.log(`Generated index for ${tracks.length} tracks.`);
