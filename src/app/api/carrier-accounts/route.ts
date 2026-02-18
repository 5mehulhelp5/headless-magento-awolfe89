import { NextRequest, NextResponse } from "next/server";
import { getMagentoHttpAuth } from "@/lib/magento/httpAuth";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

const MAGENTO_BASE = (
  process.env.MAGENTO_GRAPHQL_URL || "https://magento.test/graphql"
).replace(/\/graphql$/, "");

const ATTR_CODE = "saved_carrier_accounts";

/**
 * Build headers for a customer-token-authenticated request to Magento REST.
 */
function buildHeaders(customerToken: string): Record<string, string> {
  const httpAuth = getMagentoHttpAuth();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (httpAuth) {
    headers["Authorization"] = httpAuth;
    headers["X-Magento-Token"] = `Bearer ${customerToken}`;
  } else {
    headers["Authorization"] = `Bearer ${customerToken}`;
  }
  return headers;
}

/**
 * Extract Bearer token from Authorization header.
 */
function extractToken(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

/**
 * GET /api/carrier-accounts
 * Returns the customer's saved carrier accounts array.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const { allowed } = rateLimit(`carrier-acct:${ip}`, 20, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const token = extractToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${MAGENTO_BASE}/rest/V1/customers/me`, {
      headers: buildHeaders(token),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch customer" }, { status: res.status });
    }

    const customer = await res.json();
    const attr = customer.custom_attributes?.find(
      (a: { attribute_code: string; value: string }) => a.attribute_code === ATTR_CODE,
    );

    let accounts = [];
    if (attr?.value) {
      try {
        accounts = JSON.parse(attr.value);
      } catch {
        console.warn(
          `[carrier-accounts] Failed to parse for customer ${customer.id}: ${attr.value?.slice(0, 200)}`,
        );
        accounts = [];
      }
    } else {
      console.log(
        `[carrier-accounts] No saved_carrier_accounts attr for customer ${customer.id}`,
      );
    }

    return NextResponse.json(accounts);
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * PUT /api/carrier-accounts
 * Saves the customer's carrier accounts array.
 * Body: { accounts: SavedCarrierAccount[] }
 */
export async function PUT(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const { allowed } = rateLimit(`carrier-acct:${ip}`, 20, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const token = extractToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { accounts: unknown[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!Array.isArray(body.accounts)) {
    return NextResponse.json({ error: "accounts must be an array" }, { status: 400 });
  }

  try {
    // First fetch current customer data to get their ID
    const getRes = await fetch(`${MAGENTO_BASE}/rest/V1/customers/me`, {
      headers: buildHeaders(token),
    });

    if (!getRes.ok) {
      return NextResponse.json({ error: "Failed to fetch customer" }, { status: getRes.status });
    }

    const customer = await getRes.json();

    // Update the custom attribute
    const existingAttrs = (customer.custom_attributes || []).filter(
      (a: { attribute_code: string }) => a.attribute_code !== ATTR_CODE,
    );

    const newValue = JSON.stringify(body.accounts);
    console.log(
      `[carrier-accounts] Saving ${body.accounts.length} accounts for customer ${customer.id} (${newValue.length} chars)`,
    );

    const putRes = await fetch(`${MAGENTO_BASE}/rest/V1/customers/me`, {
      method: "PUT",
      headers: buildHeaders(token),
      body: JSON.stringify({
        customer: {
          id: customer.id,
          email: customer.email,
          firstname: customer.firstname,
          lastname: customer.lastname,
          website_id: customer.website_id,
          custom_attributes: [
            ...existingAttrs,
            {
              attribute_code: ATTR_CODE,
              value: newValue,
            },
          ],
        },
      }),
    });

    if (!putRes.ok) {
      const text = await putRes.text().catch(() => "");
      console.error("Carrier accounts save error:", putRes.status, text);
      return NextResponse.json({ error: "Failed to save" }, { status: putRes.status });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
