// Shared AG Grid setup for query result grids. Everything here is created
// once at module level: grid props that change identity on every render
// (theme, defaultColDef, callbacks) make AG Grid re-apply them, which
// re-renders and re-styles the whole grid on each parent re-render.
import {
  AllCommunityModule,
  colorSchemeDark,
  themeBalham,
  type CellClassParams,
  type ColDef,
  type RowClassParams,
  type RowStyle,
  type ValueFormatterParams,
} from "ag-grid-community";

export const GRID_MODULES = [AllCommunityModule];
export const GRID_THEME_LIGHT = themeBalham;
export const GRID_THEME_DARK = themeBalham.withPart(colorSchemeDark);

// Cells are plain text produced by a valueFormatter, which AG Grid writes
// straight into the DOM; a React cell renderer would mount a component per
// cell. Text is set via textContent, so values are never parsed as HTML.
// Nested values (arrays, maps, tuples) are single-line JSON: multi-line cells
// need auto row height, and re-measuring rows as columns scroll into view
// made wide results stutter.
export function formatCellValue(params: ValueFormatterParams): string {
  const { value } = params;
  if (value === null || value === undefined) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export const DEFAULT_COL_DEF: ColDef = {
  flex: 1,
  minWidth: 130,
  sortable: true,
  filter: true,
  resizable: true,
  filterParams: { buttons: ["reset", "apply"] },
  valueFormatter: formatCellValue,
  cellClassRules: {
    "grid-cell-null": (params: CellClassParams) => params.value == null,
  },
};

export function getTotalsRowStyle(params: RowClassParams): RowStyle | undefined {
  return params.node.rowPinned ? { fontWeight: "bold" } : undefined;
}
