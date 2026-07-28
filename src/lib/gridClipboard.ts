import type { ClipboardEvent } from "react";

// AG Grid Community renders rows/cells as plain <div>s (no <table>/<tr>/<td>
// semantics), so a native browser text selection has no column delimiters —
// copying it serializes as newline-separated text with nothing between
// cells, which spreadsheet apps (Google Sheets/Docs) then paste as a single
// column. This intercepts the browser's copy event, rebuilds the selected
// cells into tab/newline-delimited (TSV) text instead, and overrides the
// clipboard payload with that.
export function handleGridCopy(e: ClipboardEvent<HTMLDivElement>): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

  const cells = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>(".ag-cell")
  );
  const selectedCells = cells.filter((cell) => selection.containsNode(cell, true));
  if (!selectedCells.length) return;

  const rowsByIndex = new Map<string, HTMLElement[]>();
  for (const cell of selectedCells) {
    const rowEl = cell.closest<HTMLElement>(".ag-row");
    if (!rowEl) continue;
    const rowIndex = rowEl.getAttribute("row-index") ?? "0";
    if (!rowsByIndex.has(rowIndex)) rowsByIndex.set(rowIndex, []);
    rowsByIndex.get(rowIndex)!.push(cell);
  }

  const tsv = Array.from(rowsByIndex.entries())
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, rowCells]) => rowCells.map((cell) => cell.textContent ?? "").join("\t"))
    .join("\n");

  e.clipboardData.setData("text/plain", tsv);
  e.preventDefault();
}
