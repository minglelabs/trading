import { NextRequest, NextResponse } from "next/server";

import { fetchPairHistory, normalizeTickerInput } from "@/lib/stooq";

export async function GET(request: NextRequest) {
  const primary = normalizeTickerInput(
    request.nextUrl.searchParams.get("primary") ?? ""
  );
  const comparison = normalizeTickerInput(
    request.nextUrl.searchParams.get("comparison") ?? ""
  );

  if (!primary || !comparison) {
    return NextResponse.json(
      { error: "티커 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (primary === comparison) {
    return NextResponse.json(
      { error: "비교하려면 서로 다른 두 티커를 입력해 주세요." },
      { status: 400 }
    );
  }

  try {
    const payload = await fetchPairHistory(primary, comparison);
    return NextResponse.json(payload, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "티커 데이터를 불러오지 못했습니다.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
