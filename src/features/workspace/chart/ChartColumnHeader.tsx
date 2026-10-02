import React, { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChartLine } from "lucide-react";
import type { IHeaderParams } from "ag-grid-community";
import { useShallow } from "zustand/react/shallow";
import useAppStore from "@/store";
import { ROLE_LABELS, columnKind, effectiveColumns } from "./chartModel";
import ChartRoleMenu, { ROLE_ICONS } from "./ChartRoleMenu";
import { setTabChartRole } from "./tabChart";

export interface ChartColumnHeaderParams {
  tabId: string;
  columnName: string;
  columnType: string;
}

/**
 * AG Grid inner header for SQL result columns. Renders the column name in
 * the grid's label (so the sort arrow stays right next to it) and portals a
 * chart-role button into the header next to the grid's filter button.
 */
const ChartColumnHeader: React.FC<IHeaderParams & ChartColumnHeaderParams> = ({
  displayName,
  eGridHeader,
  tabId,
  columnName,
  columnType,
}) => {
  const kind = columnKind(columnType);
  const { role, timeOwner } = useAppStore(
    useShallow((s) => {
      const tab = s.tabs.find((t) => t.id === tabId);
      const cols = effectiveColumns(tab?.chart, tab?.result?.meta);
      return {
        role: cols.find((c) => c.name === columnName)?.role,
        timeOwner: cols.find((c) => c.role === "time" && c.name !== columnName)
          ?.name,
      };
    })
  );

  // The label container is a row-reverse flex box laid out in DOM order
  // [menu][filter][label], so a node inserted before the label shows up
  // between the label and the filter button. Being outside the label also
  // keeps clicks on the button from sorting the column.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const label = eGridHeader?.querySelector(
      ".ag-cell-label-container > .ag-header-cell-label"
    );
    if (!label?.parentElement) return;
    const el = document.createElement("span");
    el.className = "chart-column-header-slot";
    label.parentElement.insertBefore(el, label);
    setSlot(el);
    return () => {
      el.remove();
      setSlot(null);
    };
  }, [eGridHeader]);

  const Icon = role ? ROLE_ICONS[role] : ChartLine;
  const title = role
    ? `Chart: ${ROLE_LABELS[role].toLowerCase()}`
    : "Add to chart";

  return (
    <>
      <span className="chart-column-header-name">{displayName}</span>
      {slot &&
        createPortal(
          <ChartRoleMenu
            column={columnName}
            kind={kind}
            role={role}
            timeOwner={timeOwner}
            onSelect={(r) => setTabChartRole(tabId, columnName, r)}
          >
            <button
              type="button"
              tabIndex={-1}
              title={title}
              aria-label={title}
              data-active={role ? "" : undefined}
              className="chart-column-header-button"
            >
              <Icon strokeWidth={2} />
            </button>
          </ChartRoleMenu>,
          slot
        )}
    </>
  );
};

export default ChartColumnHeader;
