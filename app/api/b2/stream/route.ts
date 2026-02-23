import { getDownloadAuthorization } from "@/lib/b2";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get("fileName");

  if (!fileName) {
    return new Response("fileName is required", { status: 400 });
  }

  const bucketName = process.env.B2_BUCKET_NAME;
  if (!bucketName) {
    return new Response("B2_BUCKET_NAME is required", { status: 500 });
  }

  try {
    const { downloadUrl, authorizationToken } = await getDownloadAuthorization(
      fileName
    );

    const encodedName = fileName
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    const range = request.headers.get("range");
    const response = await fetch(
      `${downloadUrl}/file/${bucketName}/${encodedName}`,
      {
        headers: {
          Authorization: authorizationToken,
          ...(range ? { range } : {})
        }
      }
    );

    if (!response.ok && response.status !== 206) {
      const message = await response.text();
      return new Response(message, { status: response.status });
    }

    const headers = new Headers();
    const contentType = response.headers.get("content-type");
    const contentLength = response.headers.get("content-length");
    const contentRange = response.headers.get("content-range");
    const acceptRanges = response.headers.get("accept-ranges");

    if (contentType) headers.set("content-type", contentType);
    if (contentLength) headers.set("content-length", contentLength);
    if (contentRange) headers.set("content-range", contentRange);
    if (acceptRanges) headers.set("accept-ranges", acceptRanges);
    headers.set("cache-control", "no-store");

    return new Response(response.body, {
      status: response.status,
      headers
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(message, { status: 500 });
  }
}
