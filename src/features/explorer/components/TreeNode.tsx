// TreeNode.tsx
import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  Database,
  Table,
  FileSpreadsheet,
  Eye,
  Trash,
  TerminalIcon,
  MoreVertical,
  FilePlus,
  FolderPlus,
  BookA,
  Columns3Cog
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ConfirmationDialog from "@/components/common/ConfirmationDialog";
import { toast } from "sonner";
import useAppStore from "@/store";
import { useShallow } from "zustand/react/shallow";
import { openTableQueryTab } from "@/features/workspace/tableQueryTab";

export interface TreeNodeData {
  name: string;
  type: "database" | "table" | "view" | "dictionary" | "materialized_view" | "saved_query";
  children?: TreeNodeData[];
  query?: string;
}

interface TreeNodeProps {
  node: TreeNodeData;
  level: number;
  searchTerm: string;
  parentDatabaseName?: string;
  refreshData: () => void;
  autoExpand?: boolean;
}

const TreeNodeInner: React.FC<TreeNodeProps> = ({
  node,
  level,
  searchTerm,
  parentDatabaseName,
  refreshData,
  autoExpand,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  // Every mounted Radix menu adds document-level listeners (and re-adds
  // pointer listeners on each keydown), so with thousands of expanded rows,
  // typing anywhere in the app got slow. A row's menus are mounted only once
  // asked for: the "…" menu on click, the context menu on right-click (it is
  // mounted next to the row, not around it, so the row is never re-created).
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [contextMenuAt, setContextMenuAt] = useState<{ x: number; y: number } | null>(null);
  const contextMenuTriggerRef = useRef<HTMLSpanElement>(null);

  // Hand the right-click over to the just-mounted menu so it opens where the
  // user clicked.
  useEffect(() => {
    if (!contextMenuAt) return;
    contextMenuTriggerRef.current?.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: contextMenuAt.x,
        clientY: contextMenuAt.y,
      })
    );
  }, [contextMenuAt]);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => Promise<void>>(
    () => async () => {}
  );
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDescription, setConfirmDescription] = useState("");
  // A narrow selector: subscribing to the whole store re-rendered every
  // node of the tree (thousands on big servers) on each store change.
  const {
    addTab,
    runQuery,
    getTabById,
    setActiveTab,
    openCreateTableModal,
    openCreateDatabaseModal,
    currentDatabase,
    setCurrentDatabase,
    setExplorerRevealPath,
  } = useAppStore(
    useShallow((s) => ({
      addTab: s.addTab,
      runQuery: s.runQuery,
      getTabById: s.getTabById,
      setActiveTab: s.setActiveTab,
      openCreateTableModal: s.openCreateTableModal,
      openCreateDatabaseModal: s.openCreateDatabaseModal,
      currentDatabase: s.currentDatabase,
      setCurrentDatabase: s.setCurrentDatabase,
      setExplorerRevealPath: s.setExplorerRevealPath,
    }))
  );

  useEffect(() => {
    if (autoExpand) {
      setIsOpen(true);
      // We're the reveal target — consume it so it doesn't re-trigger if
      // this same database re-renders later (e.g. after a manual collapse).
      setExplorerRevealPath(null);
    }
  }, [autoExpand]);

  const toggleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }, []);

  const openInfoTab = (database: string, table: string) => {
    const title = `${database}${table ? `.${table}` : ""}`;
    const existingTab = getTabById(title);

    if (existingTab) {
      setActiveTab(existingTab.id);
    } else {
      addTab({
        id: title,
        title: title,
        type: "information",
        content: { database, table },
      });
    }
  };

  const handleQueryData = useCallback(
    (database: string, table: string) => () =>
      openTableQueryTab(database, table),
    []
  );

  const getIcon = useMemo(() => {
    switch (node.type) {
      case "database":
        return <Database className="w-4 h-4 mr-2" />;
      case "table":
        return <Table className="w-4 h-4 mr-2" />;
      case "view":
        return <FileSpreadsheet className="w-4 h-4 mr-2" />;
      case "dictionary":
        return <BookA className="w-4 h-4 mr-2" />;
      case "materialized_view":
        return <Columns3Cog className="w-4 h-4 mr-2" />;
      case "saved_query":
        return <TerminalIcon className="w-4 h-4 mr-2" />;
      default:
        return null;
    }
  }, [node.type]);

  const actionDropDatabase = async (database: string) => {
    setConfirmTitle(`Drop Database ${database}`);
    setConfirmDescription(
      `Are you sure you want to drop the database ${database}? This action cannot be undone.`
    );
    setConfirmAction(() => async () => {
      try {
        const result = await runQuery(`DROP DATABASE ${database}`);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(`Dropped database ${database}`);
          refreshData();
        }
      } catch (error) {
        toast.error(`Failed to drop database ${database}`);
      }
    });
    setIsConfirmDialogOpen(true); // ✅ Corrected to open the dialog
  };

  const actionDropTable = async (database: string, table: string) => {
    setConfirmTitle(`Drop Table ${table}`);
    setConfirmDescription(
      `Are you sure you want to drop the table ${database}.${table}? This action cannot be undone.`
    );

    setConfirmAction(() => async () => {
      try {
        await runQuery(`DROP TABLE \`${database}\`.\`${table}\``);
        toast.success(`Dropped table ${table}`);
        refreshData();
      } catch (error) {
        toast.error(`Failed to drop table ${table}`);
      }
    });
    setIsConfirmDialogOpen(true); // ✅ Corrected to open the dialog
  };

  const actionDropView = async (database: string, view: string) => {
    setConfirmTitle(`Drop View ${view}`);
    setConfirmDescription(
      `Are you sure you want to drop the view ${database}.${view}? This action cannot be undone.`
    );

    setConfirmAction(() => async () => {
      try {
        await runQuery(`DROP VIEW ${database}.${view}`);
        toast.success(`Dropped view ${view}`);
        refreshData();
      } catch (error) {
        toast.error(`Failed to drop view ${view}`);
      }
    });
    setIsConfirmDialogOpen(true); // ✅ Opens the dialog for views
  };

  const actionDropDictionary = async (database: string, dictionary: string) => {
    setConfirmTitle(`Drop Dictionary ${dictionary}`);
    setConfirmDescription(
      `Are you sure you want to drop the dictionary ${database}.${dictionary}? This action cannot be undone.`
    );

    setConfirmAction(() => async () => {
      try {
        await runQuery(`DROP DICTIONARY ${database}.${dictionary}`);
        toast.success(`Dropped dictionary ${dictionary}`);
        refreshData();
      } catch (error) {
        toast.error(`Failed to drop dictionary ${dictionary}`);
      }
    });
    setIsConfirmDialogOpen(true); // ✅ Opens the dialog for views
  };

  const actionDropMaterializedView = async (database: string, materializedView: string) => {
    setConfirmTitle(`Drop Materialized View ${materializedView}`);
    setConfirmDescription(
      `Are you sure you want to drop the materialized view ${database}.${materializedView}? This action cannot be undone.`
    );

    setConfirmAction(() => async () => {
      try {
        await runQuery(`DROP TABLE ${database}.${materializedView}`);
        toast.success(`Dropped materialized view ${materializedView}`);
        refreshData();
      } catch (error) {
        toast.error(`Failed to drop materialized view ${materializedView}`);
      }
    });
    setIsConfirmDialogOpen(true); // ✅ Opens the dialog for materialized views
  };

  const contextMenuOptions = useMemo(
    () => ({
      database: [
        {
          label: "View Info",
          icon: <Eye className="w-4 h-4 mr-2" />,
          action: () => openInfoTab(node.name, ""),
        },
        {
          label: "Create Table",
          icon: <FilePlus className="w-4 h-4 mr-2" />,
          action: () => openCreateTableModal(node.name),
        },
        {
          label: "Create Database",
          icon: <FolderPlus className="w-4 h-4 mr-2" />,
          action: () => openCreateDatabaseModal(),
        },
        {
          label: "Delete",
          icon: <Trash className="w-4 h-4 mr-2" />,
          action: () => actionDropDatabase(node.name),
        },
      ],
      table: [
        {
          label: "Query Table",
          icon: <TerminalIcon className="w-4 h-4 mr-2" />,
          action: parentDatabaseName
            ? handleQueryData(parentDatabaseName, node.name)
            : () => {
                toast.error("Parent database name is undefined.");
              },
        },
        {
          label: "Delete",
          icon: <Trash className="w-4 h-4 mr-2" />,
          action: parentDatabaseName
            ? () => actionDropTable(parentDatabaseName, node.name)
            : () => {
                toast.error("Parent database name is undefined.");
              },
        },
      ],
      view: [
        {
          label: "Query View",
          icon: <TerminalIcon className="w-4 h-4 mr-2" />,
          action: parentDatabaseName
            ? handleQueryData(parentDatabaseName, node.name)
            : () => {
                toast.error("Parent database name is undefined.");
              },
        },
        {
          label: "Delete",
          icon: <Trash className="w-4 h-4 mr-2" />,
          action: parentDatabaseName
            ? () => actionDropView(parentDatabaseName, node.name)
            : () => {
                toast.error("Parent database name is undefined.");
              },
        },
      ],
      dictionary: [
        {
          label: "Query Dictionary",
          icon: <TerminalIcon className="w-4 h-4 mr-2" />,
          action: parentDatabaseName
            ? handleQueryData(parentDatabaseName, node.name)
            : () => {
                toast.error("Parent database name is undefined.");
              },
        },
        {
          label: "Delete Dictionary",
          icon: <Trash className="w-4 h-4 mr-2" />,
          action: parentDatabaseName
            ? () => actionDropDictionary(parentDatabaseName, node.name)
            : () => {
                toast.error("Parent database name is undefined.");
              },
        },
      ],
      materialized_view: [
        {
          label: "Query Materialized View",
          icon: <TerminalIcon className="w-4 h-4 mr-2" />,
          action: parentDatabaseName
            ? handleQueryData(parentDatabaseName, node.name)
            : () => {
                toast.error("Parent database name is undefined.");
              },
        },
        {
          label: "Delete Materialized View",
          icon: <Trash className="w-4 h-4 mr-2" />,
          action: parentDatabaseName
            ? () => actionDropMaterializedView(parentDatabaseName, node.name)
            : () => {
                toast.error("Parent database name is undefined.");
              }
            }
      ],
    }),
    [
      parentDatabaseName,
      node.name,
      handleQueryData,
      actionDropDatabase,
      actionDropTable,
      actionDropView,
      actionDropDictionary,
      actionDropMaterializedView,
    ]
  );

  const matchesSearch = node.name
    .toLowerCase()
    .includes(searchTerm.toLowerCase());
  const childrenMatchSearch = node.children?.some(
    (child) =>
      child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      child.children?.some((grandchild) =>
        grandchild.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  const shouldRender = !searchTerm || matchesSearch || childrenMatchSearch;

  if (!shouldRender) return null;

  const menuOptions =
    contextMenuOptions[node.type as keyof typeof contextMenuOptions];

  const row = (
    <div
      className={`flex items-center py-1 px-2 hover:bg-secondary hover:rounded-md cursor-pointer truncate
      ${level > 0 ? "ml-4" : ""}`}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenuAt({ x: e.clientX, y: e.clientY });
      }}
      onMouseDown={(e) => {
        // Cmd/Ctrl+click is repurposed below to open "Query Table" —
        // without this, the browser's native modifier-click handling
        // ends up selecting the tree's text instead.
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
        }
      }}
      onClick={(e) => {
        if (
          node.type === "table" ||
          node.type === "view" ||
          node.type === "dictionary" ||
          node.type === "materialized_view"
        ) {
          e.stopPropagation();
          if (!parentDatabaseName) {
            toast.error("Parent database name is undefined.");
          } else if (e.metaKey || e.ctrlKey) {
            handleQueryData(parentDatabaseName, node.name)();
          } else {
            openInfoTab(parentDatabaseName, node.name);
          }
        } else {
          toggleOpen(e);
        }
      }}
      onDoubleClick={(e) => {
        if (node.type === "database") {
          e.stopPropagation();
          setCurrentDatabase(node.name);
        }
      }}
    >
      <div className="flex-grow flex items-center">
        {node.children ? (
          isOpen ? (
            <ChevronDown className="w-4 h-4 mr-1" />
          ) : (
            <ChevronRight className="w-4 h-4 mr-1" />
          )
        ) : (
          <div className="w-6 mr-1" />
        )}
        {getIcon}
        <div
          className={`text-xs ${
            node.type === "database" && node.name === currentDatabase
              ? "font-semibold"
              : ""
          }`}
        >
          <p className="truncate"> {node.name}</p>
        </div>
        {node.type === "database" && node.name === currentDatabase && (
          <span
            className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0"
            title="Current database"
          />
        )}
      </div>
      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
        {isDropdownOpen ? (
          <DropdownMenu open onOpenChange={setIsDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {menuOptions.map((option, index) => (
                <DropdownMenuItem key={index} onSelect={option.action}>
                  {option.icon}
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => setIsDropdownOpen(true)}
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <span>{row}</span>
      {contextMenuAt && (
        <ContextMenu
          modal={false}
          onOpenChange={(open) => {
            if (!open) setContextMenuAt(null);
          }}
        >
          <ContextMenuTrigger ref={contextMenuTriggerRef} className="hidden" />
          <ContextMenuContent>
            {menuOptions.map((option, index) => (
              <ContextMenuItem key={index} onSelect={option.action}>
                {option.icon}
                {option.label}
              </ContextMenuItem>
            ))}
          </ContextMenuContent>
        </ContextMenu>
      )}
      {(isOpen || searchTerm) && node.children && (
        <div>
          {node.children.length > 0 ? (
            node.children.map((child, index) => (
              <TreeNode
                key={index}
                node={child}
                level={level + 1}
                searchTerm={searchTerm}
                parentDatabaseName={
                  node.type === "database" ? node.name : parentDatabaseName
                }
                refreshData={refreshData}
              />
            ))
          ) : (
            <div className="ml-6 pl-4 text-xs italic text-muted-foreground">
              Nothing to show
            </div>
          )}
        </div>
      )}
      <ConfirmationDialog
        isOpen={isConfirmDialogOpen}
        variant="danger"
        onClose={() => setIsConfirmDialogOpen(false)}
        onConfirm={async () => {
          await confirmAction();
          setIsConfirmDialogOpen(false);
        }}
        title={confirmTitle}
        description={confirmDescription}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </>
  );
};

// Memoized (children render through it too): node props are stable, so
// unrelated parent re-renders skip the whole subtree.
const TreeNode = React.memo(TreeNodeInner);

export default TreeNode;
