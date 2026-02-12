import { NextRequest, NextResponse } from "next/server";
import { getMagentoHttpAuth } from "@/lib/magento/httpAuth";
import { magentoRestPost } from "@/lib/magento/rest";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

const MAGENTO_BASE = (
  process.env.MAGENTO_GRAPHQL_URL || "https://magento.test/graphql"
).replace(/\/graphql$/, "");

interface PlaceOrderBody {
  cartId: string;
  customerToken?: string;
  paymentMethod: {
    code: string;
    additional_data?: Record<string, string>;
  };
  billingAddress: {
    firstname: string;
    lastname: string;
    street: string[];
    city: string;
    region?: string;
    region_code: string;
    region_id?: number;
    postcode: string;
    country_id: string;
    telephone: string;
  };
  email?: string;
  poNumber?: string;
  carrierInfo?: {
    carrier: string;
    accountNumber: string;
  };
}

/**
 * POST /api/checkout/place-order
 *
 * Bridges the browser to Magento's REST payment-information endpoint.
 * This is needed for payment modules (like Sage/Paya) that extend the
 * standard REST interface but lack GraphQL support.
 *
 * For logged-in customers: uses their Bearer token → POST /carts/mine/payment-information
 * For guests: uses admin token → POST /guest-carts/{cartId}/payment-information
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const { allowed } = rateLimit(`place-order:${ip}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429 },
    );
  }

  let body: PlaceOrderBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { cartId, customerToken, paymentMethod, billingAddress, email, poNumber, carrierInfo } = body;

  if (!cartId || !paymentMethod?.code) {
    return NextResponse.json(
      { error: "cartId and paymentMethod.code are required" },
      { status: 400 },
    );
  }

  // Build the Magento REST payload
  // https://developer.adobe.com/commerce/webapi/rest/tutorials/orders/order-create-order/
  const payload: Record<string, unknown> = {
    paymentMethod: {
      method: paymentMethod.code,
      ...(paymentMethod.additional_data
        ? { additional_data: paymentMethod.additional_data }
        : {}),
    },
    billingAddress: {
      firstname: billingAddress.firstname,
      lastname: billingAddress.lastname,
      street: billingAddress.street,
      city: billingAddress.city,
      region: billingAddress.region || billingAddress.region_code,
      region_code: billingAddress.region_code,
      region_id: billingAddress.region_id || 0,
      postcode: billingAddress.postcode,
      country_id: billingAddress.country_id,
      telephone: billingAddress.telephone,
    },
  };

  // Guest carts require the email in the payload
  if (!customerToken && email) {
    (payload as Record<string, unknown>).email = email;
  }

  // Determine endpoint and auth token
  let endpoint: string;
  let bearerToken: string;

  if (customerToken) {
    // Logged-in customer — use their own token
    endpoint = `${MAGENTO_BASE}/rest/V1/carts/mine/payment-information`;
    bearerToken = customerToken;
    console.log("[place-order] Flow: customer (carts/mine)");
  } else {
    // Guest — use cart ID in the URL
    endpoint = `${MAGENTO_BASE}/rest/V1/guest-carts/${encodeURIComponent(cartId)}/payment-information`;
    bearerToken = "";
    console.log("[place-order] Flow: guest (guest-carts/" + cartId + ")");
  }

  const httpAuth = getMagentoHttpAuth();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (httpAuth && bearerToken) {
    // Dev environment: Basic auth for nginx, X-Magento-Token for Magento
    headers["Authorization"] = httpAuth;
    headers["X-Magento-Token"] = `Bearer ${bearerToken}`;
  } else if (httpAuth) {
    // Guest on dev environment — just nginx auth
    headers["Authorization"] = httpAuth;
  } else if (bearerToken) {
    headers["Authorization"] = `Bearer ${bearerToken}`;
  }

  // Log sanitized payload for debugging
  const debugPayload = JSON.parse(JSON.stringify(payload));
  if (debugPayload.paymentMethod?.additional_data) {
    debugPayload.paymentMethod.additional_data.cc_number = "****";
    debugPayload.paymentMethod.additional_data.cc_cid = "***";
    debugPayload.paymentMethod.additional_data.grecaptcha_response =
      debugPayload.paymentMethod.additional_data.grecaptcha_response ? "[present]" : "[missing]";
  }
  console.log("[place-order] Endpoint:", endpoint);
  console.log("[place-order] Payload:", JSON.stringify(debugPayload, null, 2));

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(
        `[place-order] Magento REST error ${res.status}:`,
        errorText,
      );

      // Try to parse Magento error message
      let message = "Failed to place order. Please try again.";
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.message) {
          message = parsed.message;
        }
      } catch {
        // Use generic message
      }

      return NextResponse.json({ error: message }, { status: res.status });
    }

    // Magento returns the order ID (number) as a plain integer on success
    const orderId = await res.json();

    // Fetch the actual order increment_id using the order entity ID
    // The payment-information endpoint returns the order entity ID (integer)
    // We need the increment_id (e.g., "000000123") for display
    let orderNumber = String(orderId);
    try {
      const orderRes = await fetchOrderIncrementId(orderId, httpAuth);
      if (orderRes) orderNumber = orderRes;
    } catch {
      // Fall back to the entity ID
    }

    // Post PO + carrier info as order comment (best-effort)
    const commentLines: string[] = [];
    if (poNumber) commentLines.push(`PO Number: ${poNumber}`);
    if (carrierInfo?.accountNumber) {
      const carrierLabel = carrierInfo.carrier?.toUpperCase() || "OTHER";
      commentLines.push(`Ship on Customer Account: ${carrierLabel} #${carrierInfo.accountNumber}`);
    }
    if (commentLines.length > 0) {
      try {
        await magentoRestPost(`/orders/${orderId}/comments`, {
          statusHistory: {
            comment: commentLines.join("\n"),
            is_customer_notified: 0,
            is_visible_on_front: 0,
          },
        });
      } catch (commentErr) {
        console.error("Failed to post order comment:", commentErr);
      }
    }

    return NextResponse.json({ orderNumber });
  } catch (err) {
    console.error("Place order error:", err);
    return NextResponse.json(
      { error: "Failed to place order. Please check your payment details." },
      { status: 500 },
    );
  }
}

/**
 * Fetch the order increment_id from Magento using the entity ID.
 */
async function fetchOrderIncrementId(
  entityId: number,
  httpAuth: string | null,
): Promise<string | null> {
  // We need an admin token for this
  const adminUser = process.env.MAGENTO_ADMIN_USER;
  const adminPass = process.env.MAGENTO_ADMIN_PASS;
  if (!adminUser || !adminPass) return null;

  // Get admin token
  const tokenRes = await fetch(
    `${MAGENTO_BASE}/rest/V1/integration/admin/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(httpAuth ? { Authorization: httpAuth } : {}),
      },
      body: JSON.stringify({ username: adminUser, password: adminPass }),
    },
  );
  if (!tokenRes.ok) return null;
  const adminToken = (await tokenRes.json()) as string;

  const orderHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (httpAuth) {
    orderHeaders["Authorization"] = httpAuth;
    orderHeaders["X-Magento-Token"] = `Bearer ${adminToken}`;
  } else {
    orderHeaders["Authorization"] = `Bearer ${adminToken}`;
  }

  const orderRes = await fetch(
    `${MAGENTO_BASE}/rest/V1/orders/${entityId}`,
    { headers: orderHeaders },
  );
  if (!orderRes.ok) return null;

  const order = (await orderRes.json()) as { increment_id?: string };
  return order.increment_id || null;
}
