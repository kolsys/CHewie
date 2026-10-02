import React from "react";
import { Clock, Sigma, Tag, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ChartRole,
  ColumnKind,
  ROLE_LABELS,
  rolesFor,
} from "./chartModel";

export const ROLE_ICONS: Record<ChartRole, React.ComponentType<{ className?: string }>> = {
  time: Clock,
  measure: Sigma,
  dimension: Tag,
};

const ROLE_HINTS: Record<ChartRole, string> = {
  time: "Date/time columns only",
  measure: "Numeric columns only",
  dimension: "",
};

const ROLE_ORDER: ChartRole[] = ["time", "measure", "dimension"];

interface ChartRoleMenuProps {
  column: string;
  kind: ColumnKind;
  role?: ChartRole;
  // Column currently holding the time axis, if it isn't this one
  timeOwner?: string;
  onSelect: (role: ChartRole | undefined) => void;
  children: React.ReactNode;
}

/** Menu for choosing how a result column is used on the chart. */
const ChartRoleMenu: React.FC<ChartRoleMenuProps> = ({
  column,
  kind,
  role,
  timeOwner,
  onSelect,
  children,
}) => {
  const allowed = rolesFor(kind);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
          Chart: {column}
        </DropdownMenuLabel>
        {ROLE_ORDER.map((r) => {
          const Icon = ROLE_ICONS[r];
          const enabled = allowed.includes(r);
          const hint = !enabled
            ? ROLE_HINTS[r]
            : r === "time" && timeOwner && role !== "time"
              ? `Replaces ${timeOwner}`
              : "";
          return (
            <DropdownMenuItem
              key={r}
              disabled={!enabled}
              onSelect={() => onSelect(r)}
              className={cn("gap-2", role === r && "bg-accent/60 font-medium")}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div className="flex min-w-0 flex-col">
                <span>{ROLE_LABELS[r]}</span>
                {hint && (
                  <span className="truncate text-xs text-muted-foreground">
                    {hint}
                  </span>
                )}
              </div>
            </DropdownMenuItem>
          );
        })}
        {role && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2" onSelect={() => onSelect(undefined)}>
              <X className="h-4 w-4" />
              Remove from chart
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ChartRoleMenu;
