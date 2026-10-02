import { useMemo, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import { useTheme } from "@/components/common/theme-provider";
import {
  DEFAULT_COL_DEF,
  GRID_MODULES,
  GRID_THEME_DARK,
  GRID_THEME_LIGHT,
  getTotalsRowStyle,
} from "@/lib/gridDefaults";
import EmptyQueryResult from "@/features/workspace/components/EmptyQueryResult";
import StatisticsDisplay from "@/features/workspace/components/StatisticsDisplay";
import DownloadDialog from "@/components/common/DownloadDialog";
import { createGridCopyHandler } from "@/lib/gridClipboard";


import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface QueryResult {
  meta?: any[];
  data?: any[];
  rows?: number;
  totals?: Record<string, any>;
  statistics?: {
    elapsed: number;
    rows_read: number;
    bytes_read: number;
  };
}

interface AgTableProps {
  data: QueryResult;
  height?: number | string; // container height
}

export default function AgTable({ data, height = "350px" }: AgTableProps) {
  const { theme } = useTheme();

  const gridTheme = theme === "light" ? GRID_THEME_LIGHT : GRID_THEME_DARK;

  const dataGridRef = useRef<AgGridReact>(null);
  const metaGridRef = useRef<AgGridReact>(null);
  const onDataCopy = useMemo(
    () => createGridCopyHandler(() => dataGridRef.current?.api),
    []
  );
  const onMetaCopy = useMemo(
    () => createGridCopyHandler(() => metaGridRef.current?.api),
    []
  );

  const dataColumnDefs = useMemo(() => {
    if (!data?.data?.length) return [];
    return Object.keys(data.data[0]).map((key) => ({
      headerName: key,
      valueGetter: (params: any) => params.data[key],
    }));
  }, [data?.data]);

  const metaColumnDefs = useMemo(() => {
    if (!data?.meta?.length) return [];
    return Object.keys(data.meta[0]).map((key) => ({
      headerName: key,
      valueGetter: (params: any) => params.data[key],
    }));
  }, [data?.meta]);

  const pinnedBottomRowData = useMemo(
    () => (data?.totals ? [data.totals] : undefined),
    [data?.totals]
  );

  // If no data is available yet or still loading
  if (!data || (!data.data && !data.meta && !data.statistics)) {
    return null;
  }

  // If there's data but it's empty
  if (data.rows === 0 || !data.data?.length) {
    return data.statistics ? (
      <EmptyQueryResult statistics={data.statistics} />
    ) : null;
  }

  const containerHeight =
    typeof height === "number" ? `${height}px` : height || "350px";
  const isFull = containerHeight === "100%";

  const exportData = data.totals
    ? [...(data.data || []), data.totals]
    : data.data || [];

  return (
    <Tabs defaultValue="results" className="h-full flex flex-col">
      <TabsList className="w-full shrink-0">
        <TabsTrigger className="w-full" value="results">
          Results {data.rows && `(${data.rows} rows)`}
        </TabsTrigger>
        <TabsTrigger className="w-full" value="metadata">
          Metadata {data.meta && `(${data.meta.length} fields)`}
        </TabsTrigger>
        <TabsTrigger className="w-full" value="statistics">
          Statistics
        </TabsTrigger>
      </TabsList>

      <TabsContent value="results" className="flex-1 min-h-0" style={{ height: 'auto' }}>
        <div className="flex items-center justify-end pb-2">
          <DownloadDialog data={exportData} />
        </div>
        <div
          className={`ag-theme-balham w-full overflow-auto ${isFull ? 'h-full flex-1 min-h-0' : ''}`}
          style={isFull ? undefined : { height: containerHeight }}
          onCopy={onDataCopy}
        >
          <AgGridReact
              ref={dataGridRef}
              rowData={data.data || []}
              columnDefs={dataColumnDefs}
              defaultColDef={DEFAULT_COL_DEF}
              pinnedBottomRowData={pinnedBottomRowData}
              getRowStyle={getTotalsRowStyle}
              modules={GRID_MODULES}
              theme={gridTheme}
              pagination={true}
              paginationPageSize={100}
              enableCellTextSelection={true}
              ensureDomOrder={true}
              domLayout="normal"
            />
        </div>
      </TabsContent>
      <TabsContent
        value="metadata"
        className="flex-1 min-h-0"
        style={{ height: 'auto' }}
      >
        <div className="flex items-center justify-end pb-2">
          <DownloadDialog data={data?.meta || []} />
        </div>
        <div
          className={`ag-theme-balham w-full overflow-auto ${isFull ? 'h-full flex-1 min-h-0' : ''}`}
          style={isFull ? undefined : { height: containerHeight }}
          onCopy={onMetaCopy}
        >
          <AgGridReact
              ref={metaGridRef}
              rowData={data.meta || []}
              columnDefs={metaColumnDefs}
              defaultColDef={DEFAULT_COL_DEF}
              modules={GRID_MODULES}
              theme={gridTheme}
              pagination={true}
              enableCellTextSelection={true}
            />
        </div>
      </TabsContent>
      <TabsContent value="statistics" className="flex-1 min-h-0 overflow-auto">
        {data.statistics && <StatisticsDisplay statistics={data.statistics} />}
      </TabsContent>
    </Tabs>
  );
}
