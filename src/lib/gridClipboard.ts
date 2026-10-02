import type { ClipboardEvent } from "react";
import type { Column, GridApi, IRowNode } from "ag-grid-community";

// AG Grid Community renders rows/cells as plain <div>s (no <table>/<tr>/<td>
// semantics), so a native browser text selection has no column delimiters —
// copying it serializes as newline-separated text with nothing between
// cells, which spreadsheet apps (Google Sheets/Docs) then paste as a single
// column. This intercepts the browser's copy event and puts tab/newline-
// delimited (TSV) text on the clipboard instead.
//
// Rows and columns are virtualized, so the selection may span rows that are
// no longer in the DOM. Only the selection's corners are read from the DOM
// (the row where a drag started keeps its focused cell and stays rendered);
// the cell values come from the grid's row model. That relies on
// `ensureDomOrder`, which keeps rendered rows in display order so a native
// selection is contiguous in row/column terms.

interface Corner {
  row: number;
  col: number; // display index
}

function selectedCorners(
  root: HTMLElement,
  selection: Selection,
  colIndex: Map<string, number>
): { first: Corner; last: Corner } | null {
  let first: Corner | null = null;
  let last: Corner | null = null;
  for (const cell of root.querySelectorAll<HTMLElement>(".ag-cell")) {
    if (!selection.containsNode(cell, true)) continue;
    const rowEl = cell.closest<HTMLElement>(".ag-row");
    const col = colIndex.get(cell.getAttribute("col-id") ?? "");
    if (!rowEl || col === undefined) continue;
    // Pinned rows carry a prefixed index (e.g. "b-0"); keep the number
    const row = Number(/\d+$/.exec(rowEl.getAttribute("row-index") ?? "")?.[0]);
    if (!Number.isFinite(row)) continue;
    if (!first || row < first.row || (row === first.row && col < first.col)) {
      first = { row, col };
    }
    if (!last || row > last.row || (row === last.row && col > last.col)) {
      last = { row, col };
    }
  }
  return first && last ? { first, last } : null;
}

function rowToTsv(
  api: GridApi,
  node: IRowNode,
  columns: Column[],
  from: number,
  to: number
): string {
  const values: string[] = [];
  for (let c = from; c <= to; c++) {
    const v = api.getCellValue({ rowNode: node, colKey: columns[c], useFormatter: true });
    values.push(v == null ? "" : String(v));
  }
  return values.join("\t");
}

/**
 * Builds an `onCopy` handler for the container around an `AgGridReact`.
 * `getApi` is read at copy time (the grid API only exists once mounted).
 */
export function createGridCopyHandler(getApi: () => GridApi | null | undefined) {
  return (e: ClipboardEvent<HTMLDivElement>): void => {
    const api = getApi();
    const selection = window.getSelection();
    if (!api || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }

    const columns = api.getAllDisplayedColumns();
    const colIndex = new Map(columns.map((c, i) => [c.getColId(), i]));
    const root = e.currentTarget;
    const lines: string[] = [];

    // Body rows: the selection runs from `first` to `last` in display order,
    // taking whole rows in between (that's what a text selection covers).
    const body = root.querySelector<HTMLElement>(".ag-body-viewport");
    const bodyCorners = body && selectedCorners(body, selection, colIndex);
    if (bodyCorners) {
      const { first, last } = bodyCorners;
      for (let r = first.row; r <= last.row; r++) {
        const node = api.getDisplayedRowAtIndex(r);
        if (!node) continue;
        const from = r === first.row ? first.col : 0;
        const to = r === last.row ? last.col : columns.length - 1;
        lines.push(rowToTsv(api, node, columns, from, to));
      }
    }

    // Pinned rows (totals) are always rendered; their row-index restarts at 0.
    const pinned = root.querySelector<HTMLElement>(".ag-floating-bottom");
    const pinnedCorners = pinned && selectedCorners(pinned, selection, colIndex);
    if (pinnedCorners) {
      const { first, last } = pinnedCorners;
      for (let r = first.row; r <= last.row; r++) {
        const node = api.getPinnedBottomRow(r);
        if (!node) continue;
        const from = r === first.row ? first.col : 0;
        const to = r === last.row ? last.col : columns.length - 1;
        lines.push(rowToTsv(api, node, columns, from, to));
      }
    }

    if (!lines.length) return;
    e.clipboardData.setData("text/plain", lines.join("\n"));
    e.preventDefault();
  };
}
