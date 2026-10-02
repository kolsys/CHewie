import useAppStore from "@/store";
import {
  ChartConfig,
  ChartRole,
  ColumnMeta,
  effectiveColumns,
  withColumnRole,
} from "./chartModel";

/** Sets (or, with `role` undefined, clears) a column's chart role on a SQL tab. */
export function setTabChartRole(
  tabId: string,
  name: string,
  role: ChartRole | undefined
) {
  const { getTabById, updateTab } = useAppStore.getState();
  const tab = getTabById(tabId);
  if (!tab) return;
  const columns = withColumnRole(
    tab.chart?.columns,
    tab.result?.meta,
    name,
    role
  );
  updateTab(tabId, { chart: { ...tab.chart, columns } });
}

/**
 * Drops chart columns the new result doesn't have (and normalizes roles to
 * the new column types), so a changed query can't leave a broken chart.
 * Returns the names that were dropped.
 */
export function syncTabChartWithResult(
  tabId: string,
  meta: ColumnMeta[] | undefined
): string[] {
  const { getTabById, updateTab } = useAppStore.getState();
  const tab = getTabById(tabId);
  const stored = tab?.chart?.columns ?? [];
  if (!tab || !stored.length || !meta?.length) return [];

  const kept = effectiveColumns(tab.chart, meta);
  const dropped = stored
    .filter((s) => !kept.some((c) => c.name === s.name))
    .map((s) => s.name);
  const changed =
    dropped.length > 0 ||
    kept.some((c) => stored.find((s) => s.name === c.name)?.role !== c.role);
  if (changed) {
    const chart: ChartConfig = {
      ...tab.chart,
      columns: kept.map(({ name, role }) => ({ name, role })),
    };
    updateTab(tabId, { chart });
  }
  return dropped;
}
