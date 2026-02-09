import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { getMagentoHttpAuthHeaders } from "@/lib/magento/httpAuth";

const MAGENTO_GRAPHQL_URL = process.env.MAGENTO_GRAPHQL_URL!;

// 200 requests per minute per IP — generous for normal browsing
const RATE_LIMIT = 200;
const RATE_WINDOW = 60 * 1000;

// Max request body size: 100KB (normal GraphQL queries are < 5KB)
const MAX_BODY_SIZE = 100 * 1024;

export async function POST(request: NextRequest) {
  // Rate limit
  const ip = getClientIp(request.headers);
  const { allowed, remaining } = rateLimit(
    `gql:${ip}`,
    RATE_LIMIT,
    RATE_WINDOW,
  );

  if (!allowed) {
    return NextResponse.json(
      { errors: [{ message: "Rate limit exceeded. Please try again later." }] },
      {
        status: 429,
        headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" },
      },
    );
  }

  // Body size guard
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return NextResponse.json(
      { errors: [{ message: "Request too large." }] },
      { status: 413 },
    );
  }

  const body = await request.text();
  if (body.length > MAX_BODY_SIZE) {
    return NextResponse.json(
      { errors: [{ message: "Request too large." }] },
      { status: 413 },
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getMagentoHttpAuthHeaders(),
  };

  // Forward auth token for customer operations
  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers["Authorization"] = authorization;
  }

  // Forward store code header
  const store = request.headers.get("store");
  if (store) {
    headers["Store"] = store;
  }

  const response = await fetch(MAGENTO_GRAPHQL_URL, {
    method: "POST",
    headers,
    body,
  });

  const data = await response.json();

  return NextResponse.json(data, {
    headers: {
      "X-RateLimit-Remaining": String(remaining),
    },
  });
}
