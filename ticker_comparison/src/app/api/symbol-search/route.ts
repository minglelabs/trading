import { NextRequest, NextResponse } from "next/server";

import { fetchTickerSuggestions } from "@/lib/stooq";

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();

  if (!query) {
    return NextResponse.json({ items: [] });
  }

  try {
    const items = await fetchTickerSuggestions(query);
    return NextResponse.json(
      { items },
      {
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Ticker suggestions are unavailable right now.";

    return NextResponse.json({ error: message, items: [] }, { status: 502 });
  }
}
