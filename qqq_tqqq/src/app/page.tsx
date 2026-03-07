import { readFile } from "node:fs/promises";
import path from "node:path";

import { RollingComparison } from "@/components/rolling-comparison";
import { ChartPayload, withDefaultSymbols } from "@/lib/chart-data";

export default async function Home() {
  const data = await loadChartData();

  return <RollingComparison initialData={data} />;
}

async function loadChartData(): Promise<ChartPayload | null> {
  try {
    const filePath = path.join(process.cwd(), "public", "chart-data.json");
    const raw = await readFile(filePath, "utf-8");
    return withDefaultSymbols(JSON.parse(raw) as ChartPayload);
  } catch {
    return null;
  }
}
