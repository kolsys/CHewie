import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@/components/common/theme-provider";
import {
  SquareTerminal,
  Github,
  Loader2,
  CircleCheckIcon,
  AlertCircleIcon,
  Sun,
  Moon,
  LifeBuoy,
  Search,
  ChevronRight,
  ChevronLeft,
  LineChart,
  BookText,
  ShieldCheck,
  CogIcon,
  ScrollText,
  Database,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ENV_BADGE_CLASS,
  ENV_DOT_CLASS,
  ENV_LABEL,
} from "@/lib/environments";
import { reinitializeMonacoClient } from "@/features/workspace/editor/monacoConfig";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { withBasePath } from "@/lib/basePath";
import useAppStore from "@/store";

const Logo = withBasePath("logo.png");

const commandsSheet = [
  {
    action: "Expand/Shrink Sidebar",
    command: ["⌘/Ctrl", "+", "B"],
    context: "Global",
  },
  {
    action: "Search Bar",
    command: ["⌘/Ctrl", "+", "K"],
    context: "Global",
  },
  {
    action: "Switch Tab",
    command: ["⌘/Ctrl", "+", "Tab Number"],
    context: "Home/Workspace",
  },
  {
    action: "Run Query",
    command: ["⌘/Ctrl", "+", "Enter"],
    context: "Home/Workspace",
  },
];

const Sidebar = () => {
  const { theme, setTheme } = useTheme();
  const {
    isServerAvailable,
    version,
    isLoadingCredentials,
    clearCredentials,
    isAdmin,
    savedConnections,
    activeConnectionId,
    switchConnection,
  } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [open, setOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // version from vite.config.ts
  const chewieVersion = __CHEWIE_VERSION__;

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const activeConnection = savedConnections.find(
    (c) => c.id === activeConnectionId
  );

  const handleSwitchConnection = async (id: string) => {
    if (id === activeConnectionId) return;
    const target = savedConnections.find((c) => c.id === id);
    await switchConnection(id);
    reinitializeMonacoClient();
    if (target) {
      toast.success(
        `Switched to ${target.name} (${ENV_LABEL[target.environment]})`
      );
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      // Toogle sidebar when pressing Cmd/Ctrl + B
      if (e.key === "b" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsExpanded((isExpanded) => !isExpanded);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!isServerAvailable) {
    return null;
  }

  const navItems = [
    { to: "/", label: "Home", icon: SquareTerminal, isNewWindow: false },
    { to: "/metrics", label: "Metrics", icon: LineChart, isNewWindow: false },
    { to: "/logs", label: "Logs", icon: ScrollText, isNewWindow: false },
  ];

  const bottomNavLinks = [
    { to: "/settings", label: "Settings", icon: CogIcon, isNewWindow: false },
    {
      to: "https://github.com/kolsys/chewie",
      label: "GitHub",
      icon: Github,
      isNewWindow: true,
    },
    {
      to: "https://github.com/kolsys/chewie#readme",
      label: "Documentation",
      icon: BookText,
      isNewWindow: true,
    },
  ];

  return (
    <div
      ref={sidebarRef}
      className={`flex flex-col h-screen bg-background border-r transition-all duration-300 ${isExpanded ? "w-64" : "w-16"
        }`}
    >
      <div className="p-2 ml-2 mt-2 flex items-center justify-between w-full">
        <Link to="/" className="flex items-center space-x-2">
          <img src={Logo} alt="Logo" className="h-8 w-8" />
          {isExpanded && (
            <span className="font-bold text-lg truncate">CHewie</span>
          )}
        </Link>
        {isExpanded && (
          <Button
            variant="link"
            size="icon"
            onClick={() => setIsExpanded(false)}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
          </Button>
        )}
      </div>

      {savedConnections.length > 0 && (
        <div className="p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {isExpanded ? (
                <Button
                  variant="outline"
                  className="w-full justify-between px-2"
                >
                  <span className="flex items-center min-w-0">
                    <span
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${activeConnection
                          ? ENV_DOT_CLASS[activeConnection.environment]
                          : "bg-muted-foreground"
                        }`}
                    />
                    <span className="ml-2 truncate text-sm">
                      {activeConnection?.name ?? "Connections"}
                    </span>
                  </span>
                  {activeConnection && (
                    <span
                      className={`ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${ENV_BADGE_CLASS[activeConnection.environment]
                        }`}
                    >
                      {ENV_LABEL[activeConnection.environment]}
                    </span>
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="icon"
                  className="w-full relative"
                >
                  <Database className="h-5 w-5" />
                  <span
                    className={`absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full ${activeConnection
                        ? ENV_DOT_CLASS[activeConnection.environment]
                        : "bg-muted-foreground"
                      }`}
                  />
                </Button>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-72">
              <DropdownMenuLabel>Connections</DropdownMenuLabel>
              {savedConnections.map((conn) => (
                <DropdownMenuItem
                  key={conn.id}
                  onSelect={() => handleSwitchConnection(conn.id)}
                  className="gap-2"
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${ENV_DOT_CLASS[conn.environment]
                      }`}
                  />
                  <span className="flex flex-col min-w-0 flex-grow">
                    <span className="truncate text-sm">{conn.name}</span>
                    <span className="truncate text-xs text-muted-foreground font-mono">
                      {conn.credential.url}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${ENV_BADGE_CLASS[conn.environment]
                      }`}
                  >
                    {ENV_LABEL[conn.environment]}
                  </span>
                  {conn.id === activeConnectionId && (
                    <Check className="h-4 w-4 shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate("/settings")}>
                <CogIcon className="h-4 w-4 mr-2" />
                Manage connections…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <ScrollArea className="flex-grow">
        <nav className="space-y-1 p-2">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              target={item.isNewWindow ? "_blank" : "_self"}
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${location.pathname === item.to
                  ? "bg-secondary text-secondary-foreground"
                  : "hover:bg-secondary/80"
                }`}
            >
              <item.icon className={`h-5 w-5 ${isExpanded ? "mr-2" : ""}`} />
              {isExpanded && <span>{item.label}</span>}
            </Link>
          ))}
          {isAdmin && (
            <Link
              to="/admin"
              className={`relative flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${location.pathname === "/admin"
                  ? "bg-secondary text-secondary-foreground"
                  : "hover:bg-secondary/80"
                }`}
            >
              <ShieldCheck className={`h-5 w-5 ${isExpanded ? "mr-2" : ""}`} />
              {isExpanded && <span>ClickHouse Admin</span>}
            </Link>
          )}
        </nav>
      </ScrollArea>

      <div className="w-full">
        <ScrollArea className="flex-grow">
          <nav className="space-y-1 p-2">
            {bottomNavLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                target={item.isNewWindow ? "_blank" : "_self"}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${location.pathname === item.to
                    ? "bg-secondary text-secondary-foreground"
                    : "hover:bg-secondary/80"
                  }`}
              >
                <item.icon className={`h-5 w-5 ${isExpanded ? "mr-2" : ""}`} />
                {isExpanded && <span>{item.label}</span>}
              </Link>
            ))}
          </nav>
        </ScrollArea>
        <Separator className="w-full mb-2" />
        <div
          className={`${isExpanded ? "flex justify-around" : "block p-2.5"}`}
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(true)}
                >
                  <Search className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <span className="text-xs">Search (Cmd/Ctrl + K)</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <LifeBuoy className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="xl:w-[1000px] xl:max-w-none sm:w-[400px] sm:max-w-[540px]">
              <SheetHeader>
                <SheetTitle>Command Cheat Sheet</SheetTitle>
                <SheetDescription>
                  Useful commands to enhance your experience.
                </SheetDescription>
              </SheetHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Command</TableHead>
                    <TableHead>Context</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commandsSheet.map((command) => (
                    <TableRow key={command.action}>
                      <TableCell>{command.action}</TableCell>
                      <TableCell>
                        <CommandShortcut>
                          {command.command.map((part, i) => (
                            <span key={i}>{part}</span>
                          ))}
                        </CommandShortcut>
                      </TableCell>
                      <TableCell>{command.context}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SheetContent>
          </Sheet>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              className={`${isExpanded
                  ? "w-full justify-items-stretch mb-2"
                  : "m-auto w-full"
                } hover:bg-transparent bg-transparent text-primary`}
            >
              {isLoadingCredentials ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isServerAvailable ? (
                <CircleCheckIcon className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircleIcon className="h-5 w-5 text-red-500" />
              )}
              {isExpanded && (
                <span className="ml-2">
                  {isLoadingCredentials
                    ? "Connecting..."
                    : isServerAvailable
                      ? "Connected"
                      : "Disconnected"}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">Server Status</p>
              <p className="text-xs">
                {isLoadingCredentials
                  ? "Connecting..."
                  : isServerAvailable
                    ? "Connected"
                    : "Disconnected"}
              </p>
              {activeConnection && (
                <p className="text-xs">
                  Connection: {activeConnection.name} (
                  {ENV_LABEL[activeConnection.environment]})
                </p>
              )}
              <p className="text-xs">Click House Version: {version}</p>
              <p className="text-xs">CHewie Version: {chewieVersion}</p>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {!isExpanded && (
        <Button
          variant="ghost"
          size="icon"
          className="m-2"
          onClick={() => setIsExpanded(true)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {navItems.map((item) => (
              <CommandItem
                key={item.to}
                onSelect={() => {
                  if (item.isNewWindow) {
                    window.open(item.to, "_blank");
                    setOpen(false);
                    return;
                  }
                  navigate(item.to);
                  setOpen(false);
                }}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="External Navigation">
            {bottomNavLinks.map((item) => (
              <CommandItem
                key={item.to}
                onSelect={() => {
                  if (item.isNewWindow) {
                    window.open(item.to, "_blank");
                    setOpen(false);
                    return;
                  }
                  navigate(item.to);
                  setOpen(false);
                }}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
          {savedConnections.length > 0 && (
            <CommandGroup heading="Connections">
              {savedConnections.map((conn) => (
                <CommandItem
                  key={conn.id}
                  onSelect={() => {
                    handleSwitchConnection(conn.id);
                    setOpen(false);
                  }}
                >
                  <span
                    className={`mr-2 h-2.5 w-2.5 rounded-full shrink-0 ${ENV_DOT_CLASS[conn.environment]
                      }`}
                  />
                  {conn.name}
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${ENV_BADGE_CLASS[conn.environment]
                      }`}
                  >
                    {ENV_LABEL[conn.environment]}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={() => {
                toast.success("Theme changed!");
                toggleTheme();
                setOpen(false);
              }}
            >
              Toggle Theme
            </CommandItem>
            <CommandItem
              onSelect={() => {
                clearCredentials();
                toast.success("Credentials cleared!");
                setOpen(false);
              }}
            >
              Reset Credentials
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
};

export default Sidebar;
