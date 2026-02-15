import { NextRequest, NextResponse } from "next/server";
import { magentoRestGet, magentoRestPut } from "@/lib/magento/rest";

/**
 * POST /api/checkout/save-quote-fields
 *
 * Saves sage_po_number and sage_comment directly on the quote
 * before order placement. This ensures the Magento quote→order
 * observer copies them to the order so they appear in email templates.
 *
 * Used by the Bill Me (GraphQL) flow where we can't pass payment
 * extension_attributes the way the REST payment-information endpoint does.
 */
export async function POST(request: NextRequest) {
  let body: {
    cartId: string;
    customerToken?: string;
    poNumber?: string;
    carrierInfo?: { carrier: string; accountNumber: string };
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { cartId, customerToken, poNumber, carrierInfo } = body;
  if (!cartId) {
    return NextResponse.json({ error: "cartId is required" }, { status: 400 });
  }

  // Build the sage_comment from carrier info
  const sageComment = carrierInfo?.accountNumber
    ? `Ship on Customer Account: ${(carrierInfo.carrier || "OTHER").toUpperCase()} #${carrierInfo.accountNumber}`
    : "";

  // Nothing to save
  if (!poNumber && !sageComment) {
    return NextResponse.json({ ok: true });
  }

  try {
    // Fetch the quote to get the current data
    let quoteEndpoint: string;
    if (customerToken) {
      // For logged-in customers, look up quote by cart ID (which is the masked quote ID)
      // Admin API can search by reserved_order_id or we use the cart directly
      quoteEndpoint = `/carts/${cartId}`;
    } else {
      quoteEndpoint = `/guest-carts/${cartId}`;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quote = await magentoRestGet<any>(quoteEndpoint);
    const quoteId = quote.id;

    // Build update payload — set the custom attributes on the quote
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePayload: any = {
      cart: {
        id: quoteId,
        ...(poNumber ? { sage_po_number: poNumber } : {}),
        ...(sageComment ? { sage_comment: sageComment } : {}),
      },
    };

    // Use admin endpoint to update the quote directly
    await magentoRestPut(`/carts/${quoteId}`, updatePayload);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[save-quote-fields] Error:", err);
    return NextResponse.json(
      { error: "Failed to save order fields" },
      { status: 500 },
    );
  }
}
