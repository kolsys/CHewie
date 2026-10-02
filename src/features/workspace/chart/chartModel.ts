// Ad-hoc charting of a SQL result: which columns the user picked and in what
// role, and how those picks turn the result rows into chart series.

export type ChartRole = "time" | "measure" | "dimension";
export type ChartType = "line" | "area" | "bar";
export type ColumnKind = "time" | "number" | "other";

export interface ChartSelection {
  name: string;
  role: ChartRole;
}

// Stored per SQL tab. An array rather than a name-keyed object so column
// names like "__proto__" or "constructor" can't clash with Object internals.
export interface ChartConfig {
  columns: ChartSelection[];
  type?: ChartType;
}

export interface ColumnMeta {
  name: string;
  type: string;
}

export interface ChartColumn {
  name: string;
  kind: ColumnKind;
  role: ChartRole;
}

export const ROLE_LABELS: Record<ChartRole, string> = {
  time: "Time axis",
  measure: "Measure",
  dimension: "Dimension",
};

// The first role is the one a column of that kind gets by default.
const ROLES_BY_KIND: Record<ColumnKind, ChartRole[]> = {
  time: ["time", "dimension"],
  number: ["measure", "dimension"],
  other: ["dimension"],
};

const WRAPPER_RE = /^(?:Nullable|LowCardinality)\((.*)\)$/;
const TIME_RE = /^(?:Date|Date32|DateTime|DateTime64)(?:\(|$)/;
const NUMBER_RE =
  /^(?:U?Int(?:8|16|32|64|128|256)|Float(?:32|64)|BFloat16|Decimal(?:32|64|128|256)?)(?:\(|$)/;

/** Classifies a ClickHouse column type, looking through Nullable/LowCardinality. */
export function columnKind(type: string): ColumnKind {
  let t = (type || "").trim();
  let m: RegExpMatchArray | null;
  while ((m = t.match(WRAPPER_RE))) t = m[1].trim();
  if (TIME_RE.test(t)) return "time";
  if (NUMBER_RE.test(t)) return "number";
  return "other";
}

export function rolesFor(kind: ColumnKind): ChartRole[] {
  return ROLES_BY_KIND[kind];
}

/**
 * Selected columns that exist in the current result, in result column order,
 * with roles coerced to what the column's type allows (a stored role can go
 * stale when the query changes). Only the first time column keeps the axis.
 */
export function effectiveColumns(
  config: ChartConfig | undefined,
  meta: ColumnMeta[] | undefined
): ChartColumn[] {
  const selected = config?.columns ?? [];
  if (!selected.length || !meta?.length) return [];
  const out: ChartColumn[] = [];
  const seen = new Set<string>();
  let hasTime = false;
  for (const col of meta) {
    if (seen.has(col.name)) continue;
    const sel = selected.find((s) => s.name === col.name);
    if (!sel) continue;
    seen.add(col.name);
    const kind = columnKind(col.type);
    const allowed = ROLES_BY_KIND[kind];
    const role = allowed.includes(sel.role) ? sel.role : allowed[0];
    if (role === "time") {
      if (hasTime) continue;
      hasTime = true;
    }
    out.push({ name: col.name, kind, role });
  }
  return out;
}

/**
 * Returns the selection with `name` set to `role` (or removed when `role` is
 * undefined). Picking a time axis drops whichever column held it before, and
 * columns missing from the current result are pruned.
 */
export function withColumnRole(
  columns: ChartSelection[] | undefined,
  meta: ColumnMeta[] | undefined,
  name: string,
  role: ChartRole | undefined
): ChartSelection[] {
  const present = new Set((meta ?? []).map((c) => c.name));
  const next = (columns ?? []).filter(
    (s) =>
      s.name !== name &&
      present.has(s.name) &&
      !(role === "time" && s.role === "time")
  );
  if (role) next.push({ name, role });
  return next;
}

export const MAX_SERIES = 20;
// Key of the x value in the rows handed to the chart; can't collide with a
// series name built from column names or values.
export const X_KEY = "\u0000x";

export type XMode = "time" | "category" | "index";

export type ChartPlan =
  | { ok: false; reason: string }
  | {
      ok: true;
      rows: Record<string, number | string | null>[];
      series: string[];
      totalSeries: number;
      xMode: XMode;
      x?: string;
      measures: string[];
      splitBy: string[];
    };

/**
 * ClickHouse writes Date/DateTime in JSON without a zone ("2024-01-31",
 * "2024-01-31 12:00:00.123456"), so they're read as browser-local time, the
 * same way the metrics charts read them. Returns epoch seconds or NaN.
 */
export function toEpochSeconds(v: unknown): number {
  if (v == null || v === "") return NaN;
  if (typeof v === "number" || /^-?\d+(\.\d+)?$/.test(String(v))) {
    // date_time_output_format = 'unix_timestamp'
    const n = Number(v);
    return Math.abs(n) > 1e11 ? Math.floor(n / 1000) : Math.floor(n);
  }
  const s = String(v).trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? `${s}T00:00:00`
    : s.replace(" ", "T").replace(/(\.\d{3})\d+/, "$1");
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? NaN : Math.floor(ms / 1000);
}

function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toLabel(v: unknown): string {
  if (v == null) return "null";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s === "" ? "(empty)" : s;
}

/**
 * Pivots result rows into one row per x value and one column per series.
 *
 * - x axis: the time column; without one, the first dimension (as
 *   categories); without either, the row number.
 * - every other dimension splits each measure into a series per value
 *   combination; the biggest MAX_SERIES (by sum of |value|) are kept.
 * - rows that share an x value and series are summed.
 */
export function buildChart(
  data: Record<string, unknown>[] | undefined,
  meta: ColumnMeta[] | undefined,
  config: ChartConfig | undefined
): ChartPlan {
  const cols = effectiveColumns(config, meta);
  const time = cols.find((c) => c.role === "time");
  const measures = cols.filter((c) => c.role === "measure").map((c) => c.name);
  const dims = cols.filter((c) => c.role === "dimension").map((c) => c.name);

  if (!measures.length) {
    return {
      ok: false,
      reason: "Pick at least one numeric column as a measure.",
    };
  }

  const xMode: XMode = time ? "time" : dims.length ? "category" : "index";
  const x = time?.name ?? (xMode === "category" ? dims[0] : undefined);
  const splitBy = xMode === "category" ? dims.slice(1) : dims;

  const buckets = new Map<number | string, Map<string, number>>();
  const totals = new Map<string, number>();

  (data ?? []).forEach((row, i) => {
    let xv: number | string;
    if (xMode === "time") {
      xv = toEpochSeconds(row[x!]);
      if (!Number.isFinite(xv)) return;
    } else if (xMode === "category") {
      xv = toLabel(row[x!]);
    } else {
      xv = i + 1;
    }

    let bucket = buckets.get(xv);
    if (!bucket) {
      bucket = new Map();
      buckets.set(xv, bucket);
    }

    const split = splitBy.map((d) => toLabel(row[d])).join(" · ");
    for (const m of measures) {
      const v = toNumber(row[m]);
      if (v == null) continue;
      const key = !splitBy.length
        ? m
        : measures.length > 1
          ? `${split} · ${m}`
          : split;
      bucket.set(key, (bucket.get(key) ?? 0) + v);
      totals.set(key, (totals.get(key) ?? 0) + Math.abs(v));
    }
  });

  if (!buckets.size) {
    return {
      ok: false,
      reason: time
        ? `No values in "${time.name}" could be read as dates.`
        : "The result has no rows to plot.",
    };
  }

  const allSeries = splitBy.length
    ? [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s)
    : measures;
  const series = allSeries.slice(0, MAX_SERIES);

  const xs = [...buckets.keys()];
  if (xMode === "time") xs.sort((a, b) => (a as number) - (b as number));

  const rows = xs.map((xv) => {
    const bucket = buckets.get(xv)!;
    const r: Record<string, number | string | null> = { [X_KEY]: xv };
    for (const s of series) r[s] = bucket.get(s) ?? null;
    return r;
  });

  return {
    ok: true,
    rows,
    series,
    totalSeries: allSeries.length,
    xMode,
    x,
    measures,
    splitBy,
  };
}
