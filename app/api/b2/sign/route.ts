import { NextResponse } from "next/server";
import { getDownloadAuthorization } from "@/lib/b2";

export const runtime = "nodejs";

type SignRequest = {
  fileName?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as SignRequest;

  if (!body.fileName) {
    return NextResponse.json({ error: "fileName is required" }, { status: 400 });
  }

  const bucketName = process.env.B2_BUCKET_NAME;
  if (!bucketName) {
    return NextResponse.json({ error: "B2_BUCKET_NAME is required" }, { status: 500 });
  }

  try {
    const { downloadUrl, authorizationToken } = await getDownloadAuthorization(
      body.fileName
    );
    const encodedName = body.fileName
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const url = `${downloadUrl}/file/${bucketName}/${encodedName}?Authorization=${authorizationToken}`;
    return NextResponse.json({ url, expiresIn: 3600 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
