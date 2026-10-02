import React, { useMemo } from "react";
import {
  ChartArea,
  ChartColumn,
  ChartLine,
  ChevronDown,
  Eraser,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import UPlotChart from "@/features/metrics/components/UPlotChart";
import {
  ChartConfig,
  ChartType,
  ColumnMeta,
  MAX_SERIES,
  X_KEY,
  buildChart,
  effectiveColumns,
} from "./chartModel";
import ChartRoleMenu, { ROLE_ICONS } from "./ChartRoleMenu";
import { setTabChartRole } from "./tabChart";

const CHART_TYPES: { type: ChartType; label: string; icon: typeof ChartLine }[] = [
  { type: "line", label: "Line", icon: ChartLine },
  { type: "area", label: "Area", icon: ChartArea },
  { type: "bar", label: "Bar", icon: ChartColumn },
];

interface ResultChartProps {
  tabId: string;
  data: Record<string, unknown>[];
  meta: ColumnMeta[];
  config: ChartConfig;
  onChange: (config: ChartConfig) => void;
}

/** "Chart" tab of a SQL result: plots the columns picked in the grid headers. */
const ResultChart: React.FC<ResultChartProps> = ({
  tabId,
  data,
  meta,
  config,
  onChange,
}) => {
  const chartType = config.type ?? "line";
  const columns = useMemo(() => effectiveColumns(config, meta), [config, meta]);
  const plan = useMemo(() => buildChart(data, meta, config), [data, meta, config]);
  const timeOwner = columns.find((c) => c.role === "time")?.name;

  return (
    <div className="h-full flex flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2">
        <div className="flex items-center rounded-md border p-0.5">
          {CHART_TYPES.map(({ type, label, icon: Icon }) => (
            <Button
              key={type}
              variant={chartType === type ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1 px-2"
              title={`${label} chart`}
              onClick={() => onChange({ ...config, type })}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs">{label}</span>
            </Button>
          ))}
        </div>

        {columns.map((col) => {
          const Icon = ROLE_ICONS[col.role];
          return (
            <ChartRoleMenu
              key={col.name}
              column={col.name}
              kind={col.kind}
              role={col.role}
              timeOwner={timeOwner !== col.name ? timeOwner : undefined}
              onSelect={(role) => setTabChartRole(tabId, col.name, role)}
            >
              <Button variant="outline" size="sm" className="h-7 gap-1 px-2">
                <Icon className="h-3.5 w-3.5 text-primary" />
                <span className="max-w-[180px] truncate text-xs">{col.name}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </ChartRoleMenu>
          );
        })}

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-7 gap-1 px-2 text-muted-foreground"
          onClick={() => onChange({ ...config, columns: [] })}
        >
          <Eraser className="h-4 w-4" />
          <span className="text-xs">Clear</span>
        </Button>
      </div>

      {plan.ok ? (
        // Scrolls when the panel is too short for the plot's minimum height
        // plus its legend.
        <div className="flex flex-1 min-h-0 flex-col overflow-auto">
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-2 text-xs text-muted-foreground">
            <span>
              X:{" "}
              <b className="text-foreground">
                {plan.x ?? "row number"}
              </b>
              {plan.xMode === "category" && " (categories)"}
            </span>
            <span>
              Y: <b className="text-foreground">{plan.measures.join(", ")}</b>
            </span>
            {plan.splitBy.length > 0 && (
              <span>
                Split by:{" "}
                <b className="text-foreground">{plan.splitBy.join(", ")}</b>
              </span>
            )}
            {plan.totalSeries > plan.series.length && (
              <span className="text-amber-600 dark:text-amber-400">
                Showing the top {MAX_SERIES} of {plan.totalSeries} series
              </span>
            )}
          </div>
          <div className="result-chart-plot flex-1 min-h-[280px] p-2">
            <UPlotChart
              data={plan.rows}
              chartType={chartType}
              indexBy={X_KEY}
              series={plan.series}
              isDateTime={plan.xMode === "time"}
              height="100%"
              showLegend
              showTooltip
              spanGaps
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <Info className="h-6 w-6" />
          <p>{plan.reason}</p>
          <p className="text-xs">
            Use the chart button in a column header to change what's plotted.
          </p>
        </div>
      )}
    </div>
  );
};

export default ResultChart;
