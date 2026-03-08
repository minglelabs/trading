import { NextRequest, NextResponse } from "next/server";

import {
  fetchTickerSuggestions,
  MIN_TICKER_SUGGESTION_QUERY_LENGTH,
} from "@/lib/stooq";

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();

  if (!query) {
    return NextResponse.json({
      startsWith: [],
      contains: [],
      minQueryLength: MIN_TICKER_SUGGESTION_QUERY_LENGTH,
    });
  }

  try {
    const groups = await fetchTickerSuggestions(query);
    return NextResponse.json(
      {
        ...groups,
        minQueryLength: MIN_TICKER_SUGGESTION_QUERY_LENGTH,
      },
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

    return NextResponse.json(
      {
        error: message,
        startsWith: [],
        contains: [],
        minQueryLength: MIN_TICKER_SUGGESTION_QUERY_LENGTH,
      },
      { status: 502 }
    );
  }
}
