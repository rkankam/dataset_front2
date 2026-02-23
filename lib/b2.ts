type B2Auth = {
  apiUrl: string;
  downloadUrl: string;
  authorizationToken: string;
  accountId: string;
  fetchedAt: number;
};

let cachedAuth: B2Auth | null = null;

const AUTH_TTL_MS = 1000 * 60 * 50;

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} in environment`);
  }
  return value;
}

async function authorizeAccount(): Promise<B2Auth> {
  if (cachedAuth && Date.now() - cachedAuth.fetchedAt < AUTH_TTL_MS) {
    return cachedAuth;
  }

  const keyId = getEnv("B2_KEY_ID");
  const applicationKey = getEnv("B2_APPLICATION_KEY");
  const basicAuth = Buffer.from(`${keyId}:${applicationKey}`).toString("base64");

  const response = await fetch(
    "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
    {
      headers: {
        Authorization: `Basic ${basicAuth}`
      }
    }
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`B2 authorize failed: ${message}`);
  }

  const data = (await response.json()) as {
    apiUrl: string;
    downloadUrl: string;
    authorizationToken: string;
    accountId: string;
  };

  cachedAuth = {
    apiUrl: data.apiUrl,
    downloadUrl: data.downloadUrl,
    authorizationToken: data.authorizationToken,
    accountId: data.accountId,
    fetchedAt: Date.now()
  };

  return cachedAuth;
}

export async function getDownloadAuthorization(fileName: string) {
  const bucketId = getEnv("B2_BUCKET_ID");
  const { apiUrl, downloadUrl, authorizationToken } = await authorizeAccount();
  const response = await fetch(`${apiUrl}/b2api/v2/b2_get_download_authorization`, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      bucketId,
      fileNamePrefix: fileName,
      validDurationInSeconds: 3600
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`B2 download auth failed: ${message}`);
  }

  const data = (await response.json()) as { authorizationToken: string };
  return {
    downloadUrl,
    authorizationToken: data.authorizationToken
  };
}
