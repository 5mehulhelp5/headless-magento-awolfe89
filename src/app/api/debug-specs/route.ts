import { NextResponse } from "next/server";
import { getProductSpecs } from "@/lib/magento/productAttributes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sku = searchParams.get("sku") || "GOR21N";

  try {
    const specs = await getProductSpecs(sku);
    return NextResponse.json({
      sku,
      specsCount: specs.length,
      specs,
      magentoUrl: process.env.MAGENTO_GRAPHQL_URL?.replace(/\/graphql$/, ""),
      hasAdminUser: !!process.env.MAGENTO_ADMIN_USER,
      hasAdminPass: !!process.env.MAGENTO_ADMIN_PASS,
      hasHttpAuth: !!process.env.MAGENTO_HTTP_AUTH,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
      magentoUrl: process.env.MAGENTO_GRAPHQL_URL?.replace(/\/graphql$/, ""),
      hasAdminUser: !!process.env.MAGENTO_ADMIN_USER,
      hasAdminPass: !!process.env.MAGENTO_ADMIN_PASS,
      hasHttpAuth: !!process.env.MAGENTO_HTTP_AUTH,
    }, { status: 500 });
  }
}
