import { NextRequest, NextResponse } from "next/server";
import { getMagentoHttpAuth } from "@/lib/magento/httpAuth";

const MAGENTO_BASE = (
  process.env.MAGENTO_GRAPHQL_URL || "https://magento.test/graphql"
).replace(/\/graphql$/, "");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const mediaPath = path.join("/");
  const mediaUrl = `${MAGENTO_BASE}/media/${mediaPath}`;

  const headers: Record<string, string> = {};
  const httpAuth = getMagentoHttpAuth();
  if (httpAuth) {
    headers["Authorization"] = httpAuth;
  }

  try {
    const response = await fetch(mediaUrl, {
      headers,
      next: { revalidate: 86400 }, // cache upstream fetch for 24h
    });

    if (!response.ok) {
      return new NextResponse(null, { status: response.status });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
