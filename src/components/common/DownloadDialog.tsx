import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";

interface DownloadDialogProps {
  data: any[];
  onExport?: (format: string) => Promise<Blob>;
  filename?: string;
  maxRows?: number;
}

// Regenerated server-side via `onExport` (re-run with FORMAT <x>), unlike
// csv/json/clipboard which format the already-fetched `data` prop locally.
export const NATIVE_TEXT_FORMATS = [
  "CSV",
  "CSVWithNames",
  "CSVWithNamesAndTypes",
  "TabSeparated",
  "TabSeparatedWithNames",
  "JSON",
  "JSONStrings",
  "JSONColumns",
  "JSONColumnsWithMetadata",
  "JSONCompact",
  "JSONEachRow",
  "PrettyJSONEachRow",
  "SQLInsert",
  "Markdown",
  "Values",
  "Prometheus",
] as const;

export const NATIVE_BINARY_FORMATS = ["Native", "Avro", "Parquet", "BSONEachRow"] as const;

export const NATIVE_FORMATS = [...NATIVE_TEXT_FORMATS, ...NATIVE_BINARY_FORMATS] as const;

export type NativeExportFormat = (typeof NATIVE_FORMATS)[number];
type QuickExportFormat = "csv" | "json" | "clipboard";

const isNativeFormat = (format: string): format is NativeExportFormat =>
  (NATIVE_FORMATS as readonly string[]).includes(format);

export const NATIVE_FORMAT_EXTENSIONS: Record<NativeExportFormat, string> = {
  CSV: "csv",
  CSVWithNames: "csv",
  CSVWithNamesAndTypes: "csv",
  TabSeparated: "tsv",
  TabSeparatedWithNames: "tsv",
  JSON: "json",
  JSONStrings: "json",
  JSONColumns: "json",
  JSONColumnsWithMetadata: "json",
  JSONCompact: "json",
  JSONEachRow: "ndjson",
  PrettyJSONEachRow: "json",
  SQLInsert: "sql",
  Markdown: "md",
  Values: "txt",
  Prometheus: "prom",
  Native: "native",
  Avro: "avro",
  Parquet: "parquet",
  BSONEachRow: "bson",
};

export const NATIVE_FORMAT_CONTENT_TYPES: Record<NativeExportFormat, string> = {
  CSV: "text/csv",
  CSVWithNames: "text/csv",
  CSVWithNamesAndTypes: "text/csv",
  TabSeparated: "text/tab-separated-values",
  TabSeparatedWithNames: "text/tab-separated-values",
  JSON: "application/json",
  JSONStrings: "application/json",
  JSONColumns: "application/json",
  JSONColumnsWithMetadata: "application/json",
  JSONCompact: "application/json",
  JSONEachRow: "application/x-ndjson",
  PrettyJSONEachRow: "text/plain",
  SQLInsert: "text/plain",
  Markdown: "text/markdown",
  Values: "text/plain",
  Prometheus: "text/plain",
  Native: "application/octet-stream",
  Avro: "application/octet-stream",
  Parquet: "application/octet-stream",
  BSONEachRow: "application/octet-stream",
};

const CHUNK_SIZE = 10000; // Number of rows to process at once

/**
 * Prepares a value for CSV export by properly handling objects and complex types.
 * Objects are serialized to JSON strings which PapaParse will then properly escape.
 */
const prepareCsvValue = (value: unknown): string | number | boolean | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "object") {
    // Convert objects/arrays to JSON strings
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return String(value);
};

/**
 * Prepares an entire row for CSV export by processing each value.
 */
const prepareRowForCsv = (row: Record<string, unknown>): Record<string, string | number | boolean | null> => {
  const prepared: Record<string, string | number | boolean | null> = {};
  for (const key of Object.keys(row)) {
    prepared[key] = prepareCsvValue(row[key]);
  }
  return prepared;
};

const getContentType = (format: QuickExportFormat): string => {
  switch (format) {
    case "csv":
      return "text/csv";
    case "json":
      return "application/json";
    default:
      return "text/plain";
  }
};

const processInChunks = async (
  data: any[],
  format: QuickExportFormat,
  chunkSize: number
): Promise<Blob> => {
  const chunks = Math.ceil(data.length / chunkSize);
  let result = "";

  for (let i = 0; i < chunks; i++) {
    const chunk = data.slice(i * chunkSize, (i + 1) * chunkSize);

    switch (format) {
      case "csv": {
        // Preprocess data to handle objects and complex types
        const preparedChunk = chunk.map(prepareRowForCsv);
        // Use PapaParse with proper escaping configuration
        const csvOptions: Papa.UnparseConfig = {
          header: i === 0,
          quotes: true, // Always quote fields to ensure proper escaping
          quoteChar: '"',
          escapeChar: '"', // Double-quote escaping as per RFC 4180
          newline: "\r\n", // Standard CSV line ending
        };
        result += Papa.unparse(preparedChunk, csvOptions);
        if (i < chunks - 1) {
          result += "\r\n"; // Add newline between chunks
        }
        break;
      }
      case "json":
      case "clipboard":
        result +=
          (i === 0 ? "[" : "") +
          chunk.map((item) => JSON.stringify(item)).join(",") +
          (i === chunks - 1 ? "]" : "");
        break;
    }

    // Allow UI to update between chunks
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return new Blob([result], { type: getContentType(format) });
};

const DownloadDialog: React.FC<DownloadDialogProps> = ({
  data,
  onExport,
  maxRows = 1000000,
}) => {
  const [nativeFormat, setNativeFormat] = useState<NativeExportFormat | "">("");
  const [nativeDialogOpen, setNativeDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const deliverBlob = async (blob: Blob, format: string) => {
    if (format === "clipboard") {
      const text = await blob.text();
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard!", { duration: 2000 });
      return;
    }

    const now = new Date().toISOString().split(".")[0].replace(/[:]/g, "-");
    const exportFilename = `ch_ui_export_${now}`;
    const extension = isNativeFormat(format)
      ? NATIVE_FORMAT_EXTENSIONS[format]
      : format;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFilename}.${extension}`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success("Download started!", { duration: 2000 });
  };

  const handleQuickExport = async (format: QuickExportFormat) => {
    if (data.length > maxRows) {
      toast.error(`Cannot export more than ${maxRows.toLocaleString()} rows`);
      return;
    }

    setIsExporting(true);
    try {
      const blob = await processInChunks(data, format, CHUNK_SIZE);
      await deliverBlob(blob, format);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data. Please try again.", {
        duration: 2000,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleNativeExport = async () => {
    if (!nativeFormat || !onExport) return;

    setIsExporting(true);
    try {
      const blob = await onExport(nativeFormat);
      await deliverBlob(blob, nativeFormat);
      setNativeDialogOpen(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data. Please try again.", {
        duration: 2000,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="link"
            className="h-4 w-4 p-0 ml-2"
            disabled={isExporting}
          >
            <Download />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleQuickExport("csv")}>
            CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleQuickExport("json")}>
            JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleQuickExport("clipboard")}>
            Copy to Clipboard
          </DropdownMenuItem>
          {onExport && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setNativeDialogOpen(true)}>
                Native export…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {onExport && (
        <Dialog open={nativeDialogOpen} onOpenChange={setNativeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Native export</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <Select
                value={nativeFormat}
                onValueChange={(value) =>
                  setNativeFormat(value as NativeExportFormat)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a native format…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {NATIVE_TEXT_FORMATS.map((format) => (
                      <SelectItem key={format} value={format}>
                        {format}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Binary</SelectLabel>
                    {NATIVE_BINARY_FORMATS.map((format) => (
                      <SelectItem key={format} value={format}>
                        {format}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Re-runs the query on the server with this FORMAT and streams the result.
              </p>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={handleNativeExport}
                  disabled={isExporting || !nativeFormat}
                >
                  {isExporting ? "Processing..." : "Export"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default DownloadDialog;
