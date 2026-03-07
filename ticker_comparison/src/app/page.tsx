import { readFile } from "node:fs/promises";
import path from "node:path";

import { RollingComparison } from "@/components/rolling-comparison";
import { ChartPayload, withDefaultSymbols } from "@/lib/chart-data";
import { fetchPairHistory, normalizeTickerInput } from "@/lib/stooq";

interface HomeProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Home({ searchParams }: HomeProps) {
  const params = searchParams ? await searchParams : {};
  const primary = normalizeTickerInput(getSingleParam(params.primary) ?? "");
  const comparison = normalizeTickerInput(getSingleParam(params.comparison) ?? "");
  const data = await loadChartData(primary, comparison);

  return <RollingComparison initialData={data} />;
}

async function loadChartData(
  primary?: string | null,
  comparison?: string | null
): Promise<ChartPayload | null> {
  if (primary && comparison && primary !== comparison) {
    try {
      return await fetchPairHistory(primary, comparison);
    } catch {
      // Fall back to the default local file when the requested pair cannot be loaded.
    }
  }

  try {
    const filePath = path.join(process.cwd(), "public", "chart-data.json");
    const raw = await readFile(filePath, "utf-8");
    return withDefaultSymbols(JSON.parse(raw) as ChartPayload);
  } catch {
    return null;
  }
}

function getSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
