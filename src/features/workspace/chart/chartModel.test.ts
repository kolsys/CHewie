import { describe, expect, it } from "vitest";
import {
  MAX_SERIES,
  X_KEY,
  buildChart,
  columnKind,
  effectiveColumns,
  toEpochSeconds,
  withColumnRole,
  type ChartConfig,
} from "./chartModel";

describe("columnKind", () => {
  it.each([
    ["DateTime", "time"],
    ["DateTime('Europe/Moscow')", "time"],
    ["DateTime64(3, 'UTC')", "time"],
    ["Nullable(Date32)", "time"],
    ["UInt64", "number"],
    ["LowCardinality(Nullable(Int32))", "number"],
    ["Decimal(18, 4)", "number"],
    ["Float64", "number"],
    ["String", "other"],
    ["LowCardinality(String)", "other"],
    ["Bool", "other"],
    ["Array(UInt8)", "other"],
    ["IntervalSecond", "other"],
  ])("%s → %s", (type, kind) => {
    expect(columnKind(type)).toBe(kind);
  });
});

describe("withColumnRole", () => {
  const meta = [
    { name: "t1", type: "DateTime" },
    { name: "t2", type: "Date" },
    { name: "n", type: "UInt64" },
  ];

  it("keeps a single time axis", () => {
    let cols = withColumnRole([], meta, "t1", "time");
    cols = withColumnRole(cols, meta, "n", "measure");
    cols = withColumnRole(cols, meta, "t2", "time");
    expect(cols).toEqual([
      { name: "n", role: "measure" },
      { name: "t2", role: "time" },
    ]);
  });

  it("removes a column and prunes ones missing from the result", () => {
    const cols = withColumnRole(
      [
        { name: "gone", role: "dimension" },
        { name: "n", role: "measure" },
      ],
      meta,
      "n",
      undefined
    );
    expect(cols).toEqual([]);
  });
});

describe("effectiveColumns", () => {
  it("follows result column order and coerces stale roles", () => {
    const config: ChartConfig = {
      columns: [
        { name: "s", role: "measure" },
        { name: "t", role: "time" },
        { name: "missing", role: "dimension" },
      ],
    };
    expect(
      effectiveColumns(config, [
        { name: "t", type: "DateTime" },
        { name: "s", type: "String" },
      ])
    ).toEqual([
      { name: "t", kind: "time", role: "time" },
      { name: "s", kind: "other", role: "dimension" },
    ]);
  });
});

describe("toEpochSeconds", () => {
  it("reads ClickHouse dates as local time", () => {
    expect(toEpochSeconds("2024-01-31")).toBe(
      new Date(2024, 0, 31).getTime() / 1000
    );
    expect(toEpochSeconds("2024-01-31 12:30:00.123456")).toBe(
      new Date(2024, 0, 31, 12, 30, 0).getTime() / 1000
    );
  });

  it("accepts unix timestamps", () => {
    expect(toEpochSeconds("1700000000")).toBe(1700000000);
    expect(toEpochSeconds(1700000000123)).toBe(1700000000);
  });

  it("returns NaN for junk", () => {
    expect(toEpochSeconds(null)).toBeNaN();
    expect(toEpochSeconds("nope")).toBeNaN();
  });
});

describe("buildChart", () => {
  const meta = [
    { name: "ts", type: "DateTime" },
    { name: "kind", type: "LowCardinality(String)" },
    { name: "code", type: "UInt16" },
    { name: "cnt", type: "UInt64" },
    { name: "avg", type: "Float64" },
  ];

  it("needs a measure", () => {
    const plan = buildChart([], meta, {
      columns: [{ name: "ts", role: "time" }],
    });
    expect(plan.ok).toBe(false);
  });

  it("plots measures over time, sorted, with 64-bit ints as strings", () => {
    const plan = buildChart(
      [
        { ts: "2024-01-01 00:02:00", cnt: "5", avg: 1.5 },
        { ts: "2024-01-01 00:01:00", cnt: "3", avg: null },
      ],
      meta,
      {
        columns: [
          { name: "cnt", role: "measure" },
          { name: "ts", role: "time" },
          { name: "avg", role: "measure" },
        ],
      }
    );
    if (!plan.ok) throw new Error(plan.reason);
    expect(plan.xMode).toBe("time");
    expect(plan.series).toEqual(["cnt", "avg"]);
    expect(plan.rows.map((r) => [r.cnt, r.avg])).toEqual([
      [3, null],
      [5, 1.5],
    ]);
    expect((plan.rows[0][X_KEY] as number) < (plan.rows[1][X_KEY] as number)).toBe(true);
  });

  it("splits by dimensions, summing duplicates", () => {
    const plan = buildChart(
      [
        { ts: "2024-01-01 00:00:00", kind: "a", cnt: "1" },
        { ts: "2024-01-01 00:00:00", kind: "a", cnt: "2" },
        { ts: "2024-01-01 00:00:00", kind: "b", cnt: "10" },
        { ts: "2024-01-01 00:01:00", kind: "b", cnt: "1" },
      ],
      meta,
      {
        columns: [
          { name: "ts", role: "time" },
          { name: "kind", role: "dimension" },
          { name: "cnt", role: "measure" },
        ],
      }
    );
    if (!plan.ok) throw new Error(plan.reason);
    expect(plan.series).toEqual(["b", "a"]); // ranked by total
    expect(plan.rows.map((r) => [r.a, r.b])).toEqual([
      [3, 10],
      [null, 1],
    ]);
  });

  it("uses the first dimension as categories without a time axis, numbers included", () => {
    const plan = buildChart(
      [
        { code: 404, kind: "x", cnt: "7" },
        { code: 200, kind: "x", cnt: "9" },
      ],
      meta,
      {
        columns: [
          { name: "code", role: "dimension" },
          { name: "cnt", role: "measure" },
        ],
      }
    );
    if (!plan.ok) throw new Error(plan.reason);
    expect(plan.xMode).toBe("category");
    expect(plan.x).toBe("code");
    // keeps the query's row order
    expect(plan.rows.map((r) => [r[X_KEY], r.cnt])).toEqual([
      ["404", 7],
      ["200", 9],
    ]);
  });

  it("falls back to row numbers with measures only", () => {
    const plan = buildChart([{ cnt: "1" }, { cnt: "2" }], meta, {
      columns: [{ name: "cnt", role: "measure" }],
    });
    if (!plan.ok) throw new Error(plan.reason);
    expect(plan.xMode).toBe("index");
    expect(plan.rows.map((r) => r[X_KEY])).toEqual([1, 2]);
  });

  it("names split series by measure when there are several", () => {
    const plan = buildChart(
      [{ kind: "a", code: 1, cnt: "1", avg: 2 }],
      meta,
      {
        columns: [
          { name: "kind", role: "dimension" },
          { name: "code", role: "dimension" },
          { name: "cnt", role: "measure" },
          { name: "avg", role: "measure" },
        ],
      }
    );
    if (!plan.ok) throw new Error(plan.reason);
    expect(plan.x).toBe("kind");
    expect(plan.splitBy).toEqual(["code"]);
    expect(plan.series.sort()).toEqual(["1 · avg", "1 · cnt"]);
  });

  it("caps the number of series", () => {
    const data = Array.from({ length: MAX_SERIES + 5 }, (_, i) => ({
      ts: "2024-01-01 00:00:00",
      kind: `k${i}`,
      cnt: String(i + 1),
    }));
    const plan = buildChart(data, meta, {
      columns: [
        { name: "ts", role: "time" },
        { name: "kind", role: "dimension" },
        { name: "cnt", role: "measure" },
      ],
    });
    if (!plan.ok) throw new Error(plan.reason);
    expect(plan.series).toHaveLength(MAX_SERIES);
    expect(plan.totalSeries).toBe(MAX_SERIES + 5);
    expect(plan.series[0]).toBe(`k${MAX_SERIES + 4}`);
  });
});
