export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { serverLogger } from "../../../lib/server-logger";

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const authorization = headersList.get("authorization");

    if (!authorization) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { tier, period = "monthly", successUrl, cancelUrl } = body;

    // Validate required parameters
    if (!tier) {
      return NextResponse.json(
        { error: "Missing required parameter: tier" },
        { status: 400 },
      );
    }

    // Validate tier value
    const validTiers = ["premium", "pro"];
    if (!validTiers.includes(tier.toLowerCase())) {
      return NextResponse.json(
        { error: "Invalid tier. Must be premium or pro" },
        { status: 400 },
      );
    }

    // Validate period value
    const validPeriods = ["monthly", "yearly"];
    if (!validPeriods.includes(period)) {
      return NextResponse.json(
        { error: "Invalid period. Must be monthly or yearly" },
        { status: 400 },
      );
    }

    // Call orchestrator to create checkout session
    const orchestratorUrl =
      process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ||
      process.env.ORCHESTRATOR_URL ||
      "http://localhost:8080";

    const response = await fetch(
      `${orchestratorUrl}/api/subscription/create-checkout-session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authorization,
        },
        body: JSON.stringify({
          tier: tier.toLowerCase(),
          period,
          successUrl,
          cancelUrl,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      serverLogger.error("Orchestrator checkout session creation failed", {
        errorData,
      });
      return NextResponse.json(
        { error: errorData.error || "Failed to create checkout session" },
        { status: response.status },
      );
    }

    const data = await response.json();

    return NextResponse.json({
      sessionUrl: data.sessionUrl,
      success: true,
    });
  } catch (error) {
    serverLogger.error("Checkout session creation error", {
      error: String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
