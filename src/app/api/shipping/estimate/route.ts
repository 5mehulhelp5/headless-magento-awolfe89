import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

const EASYPOST_API_KEY = process.env.EASYPOST_API_KEY;
const EASYPOST_API_URL = "https://api.easypost.com/v2";

/** Warehouse origin address (Cary, IL) */
const FROM_ADDRESS = {
  company: "Technimark",
  street1: "720 Industrial Dr",
  city: "Cary",
  state: "IL",
  zip: "60013",
  country: "US",
  phone: "8476394700",
};

/** Default parcel dimensions (inches) for when we only have weight */
const DEFAULT_PARCEL = {
  length: 12,
  width: 10,
  height: 6,
};

/** Friendly service name overrides */
const SERVICE_LABELS: Record<string, string> = {
  Ground: "Ground",
  GroundAdvantage: "Ground Advantage",
  Express: "Priority Mail Express",
  Priority: "Priority Mail",
  First: "First-Class",
  ParcelSelect: "Parcel Select",
  "3DaySelect": "3 Day Select",
  "2ndDayAir": "2nd Day Air",
  "2ndDayAirAM": "2nd Day Air AM",
  NextDayAir: "Next Day Air",
  NextDayAirSaver: "Next Day Air Saver",
  NextDayAirEarlyAM: "Next Day Air Early AM",
  UPSGroundsaverGreaterThan1lb: "Ground Saver",
  FEDEX_GROUND: "Ground",
  GROUND_HOME_DELIVERY: "Home Delivery",
  FEDEX_EXPRESS_SAVER: "Express Saver",
  FEDEX_2_DAY: "2-Day",
  STANDARD_OVERNIGHT: "Standard Overnight",
  PRIORITY_OVERNIGHT: "Priority Overnight",
};

/** Map EasyPost carrier codes to display names */
const CARRIER_NAMES: Record<string, string> = {
  UPSDAP: "UPS",
  UPS: "UPS",
  USPS: "USPS",
  FEDEX: "FedEx",
  FedEx: "FedEx",
};

/* ─── In-memory rate cache ─── */
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

interface CachedRates {
  rates: FormattedRate[];
  expiresAt: number;
}

interface FormattedRate {
  carrier: string;
  carrierTitle: string;
  method: string;
  methodTitle: string;
  price: number;
  estimatedDays: string;
}

const rateCache = new Map<string, CachedRates>();

// Clean up expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateCache) {
    if (now > entry.expiresAt) rateCache.delete(key);
  }
}, 10 * 60 * 1000);

function getCacheKey(weightOz: number, zipCode: string): string {
  // Round weight to nearest oz to increase cache hits
  return `${Math.round(weightOz)}:${zipCode}`;
}

/* ─── Helpers ─── */

interface EstimateRequest {
  sku: string;
  qty?: number;
  weight?: number; // product weight in lbs (from GraphQL)
  zipCode: string;
}

interface EasyPostRate {
  id: string;
  carrier: string;
  service: string;
  rate: string;
  currency: string;
  delivery_days: number | null;
  est_delivery_days: number | null;
  delivery_date: string | null;
  list_rate: string;
  retail_rate: string;
}

function formatDeliveryDays(days: number | null): string {
  if (!days) return "";
  if (days === 1) return "1 business day";
  return `${days} business days`;
}

function friendlyCarrier(carrier: string): string {
  return CARRIER_NAMES[carrier] || carrier;
}

function friendlyService(service: string): string {
  return SERVICE_LABELS[service] || service.replace(/([A-Z])/g, " $1").trim();
}

/* ─── Route handler ─── */

export async function POST(request: NextRequest) {
  if (!EASYPOST_API_KEY) {
    return NextResponse.json(
      { error: "Shipping estimates are not configured" },
      { status: 503 },
    );
  }

  // Rate-limit: 20 requests per 60 seconds per IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed } = rateLimit(`shipping-estimate:${ip}`, 20, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429 },
    );
  }

  let body: EstimateRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { qty = 1, weight, zipCode } = body;

  if (!zipCode) {
    return NextResponse.json(
      { error: "zipCode is required" },
      { status: 400 },
    );
  }

  // Validate zip format (US 5-digit)
  if (!/^\d{5}$/.test(zipCode)) {
    return NextResponse.json(
      { error: "Please enter a valid 5-digit US ZIP code" },
      { status: 400 },
    );
  }

  // Weight in ounces — EasyPost expects oz
  // Product weight from Magento is in lbs; default to 1 lb if missing
  const weightLbs = (weight && weight > 0 ? weight : 1) * qty;
  const weightOz = weightLbs * 16;

  // Check cache first
  const cacheKey = getCacheKey(weightOz, zipCode);
  const cached = rateCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json({ rates: cached.rates, cached: true });
  }

  try {
    const res = await fetch(`${EASYPOST_API_URL}/shipments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(EASYPOST_API_KEY + ":").toString("base64")}`,
      },
      body: JSON.stringify({
        shipment: {
          from_address: FROM_ADDRESS,
          to_address: {
            zip: zipCode,
            country: "US",
          },
          parcel: {
            ...DEFAULT_PARCEL,
            weight: weightOz,
          },
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("EasyPost API error:", res.status, errBody);
      return NextResponse.json(
        { error: "Unable to estimate shipping rates. Please try again." },
        { status: 502 },
      );
    }

    const data = await res.json();
    const easypostRates: EasyPostRate[] = data.rates || [];

    // Filter and format rates
    const rates: FormattedRate[] = easypostRates
      .filter((r) => parseFloat(r.rate) > 0)
      .map((r) => ({
        carrier: r.carrier.toLowerCase(),
        carrierTitle: friendlyCarrier(r.carrier),
        method: r.service,
        methodTitle: friendlyService(r.service),
        price: parseFloat(r.rate),
        estimatedDays: formatDeliveryDays(r.delivery_days ?? r.est_delivery_days),
      }))
      .sort((a, b) => a.price - b.price);

    // Cache the result
    rateCache.set(cacheKey, { rates, expiresAt: Date.now() + CACHE_TTL });

    return NextResponse.json({ rates });
  } catch (err) {
    console.error("Shipping estimate error:", err);
    return NextResponse.json(
      { error: "Unable to estimate shipping rates. Please try again." },
      { status: 500 },
    );
  }
}
