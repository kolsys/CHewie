import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Settings,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  LogOut,
  Server,
  User,
  Lock,
  Cog,
  FileClock,
  Share2,
  Trash2,
  Database,
  Pencil,
  Plus,
  Tag,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import useAppStore from "@/store";
import { reinitializeMonacoClient } from "@/features/workspace/editor/monacoConfig";
import {
  Credential,
  ConnectionEnvironment,
  SavedConnection,
} from "@/types/common";
import {
  ENVIRONMENTS,
  ENV_BADGE_CLASS,
  ENV_DOT_CLASS,
  ENV_LABEL,
} from "@/lib/environments";

// Custom URL validator that accepts both standard URLs and IP addresses with ports
const isValidClickHouseUrl = (url: string): boolean => {
  if (!url) return false;

  try {
    // Try to parse as URL - this will work for both domain names and IP addresses
    const parsed = new URL(url);

    // Check if it has a valid protocol
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }

    // Check if it has a hostname (can be domain or IP)
    if (!parsed.hostname) {
      return false;
    }

    // Basic IP address pattern check (IPv4)
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    // Basic IPv6 pattern check (simplified)
    const ipv6Pattern = /^(\[)?[0-9a-fA-F:]+(\])?$/;

    // If it's an IP address, ensure it's valid
    if (ipv4Pattern.test(parsed.hostname)) {
      const parts = parsed.hostname.split(".");
      return parts.every((part) => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
      });
    }

    // For IPv6, basic validation (URL constructor handles most of it)
    if (ipv6Pattern.test(parsed.hostname.replace(/[\[\]]/g, ""))) {
      return true;
    }

    // For domain names, just ensure it's not empty
    return parsed.hostname.length > 0;
  } catch {
    return false;
  }
};

const formSchema = z.object({
  connectionName: z.string().optional(),
  environment: z.enum(["dev", "staging", "prod"]).optional(),
  url: z.string().min(1, "URL is required").refine(isValidClickHouseUrl, {
    message:
      "Invalid URL. Please use format: http://hostname:port or http://ip-address:port",
  }),
  username: z.string().min(1, "Username is required"),
  password: z.string().optional(),
  useAdvanced: z.boolean().optional(),
  customPath: z.string().optional(),
  customParams: z
    .string()
    .optional()
    .refine(
      (value) =>
        !value ||
        value
          .split(/[&,\s]+/)
          .filter(Boolean)
          .every((pair) => /^[\w.]+=[^=]*$/.test(pair)),
      {
        message:
          "Expected key=value pairs separated by &, comma or space (e.g. enable_analyzer=0&max_execution_time=300)",
      }
    ),
  requestTimeout: z.coerce
    .number()
    .int("Request timeout must be a whole number")
    .min(1000, "Request timeout must be at least 1000 millisecond")
    .max(600000, "Request timeout must not exceed 600000 milliseconds"),
  isDistributed: z.boolean().optional(),
  clusterName: z.string().optional(),
});

export default function SettingsPage() {
  document.title = "CH-UI | Settings";
  const {
    credential,
    setCredential,
    checkServerStatus,
    isLoadingCredentials,
    isServerAvailable,
    version,
    error,
    clearCredentials,
    credentialSource,
    setCredentialSource,
    clearLocalData,
    savedConnections,
    activeConnectionId,
    saveConnection,
    deleteConnection,
    switchConnection,
  } = useAppStore();

  const [editingId, setEditingId] = useState<string | null>(
    activeConnectionId
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showDistributedSettings, setShowDistributedSettings] = useState(
    credential?.isDistributed || false
  );
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const shareLinkConnectionNotFound = Boolean(
    (location.state as { shareLinkConnectionNotFound?: boolean } | null)
      ?.shareLinkConnectionNotFound
  );

  type FormData = {
    connectionName?: string;
    environment?: ConnectionEnvironment;
    url: string;
    username: string;
    password?: string;
    useAdvanced?: boolean;
    customPath?: string;
    customParams?: string;
    requestTimeout: unknown;
    isDistributed?: boolean;
    clusterName?: string;
  };
  const editingConnection = savedConnections.find((c) => c.id === editingId);
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      connectionName: editingConnection?.name || "",
      environment: editingConnection?.environment || "dev",
      url: searchParams.get("url") || credential?.url || "",
      username: searchParams.get("username") || credential?.username || "",
      password: searchParams.get("password") || credential?.password || "",
      requestTimeout:
        Number(searchParams.get("requestTimeout")) ||
        credential?.requestTimeout ||
        30000,
      useAdvanced: searchParams.get("useAdvanced") === "true" || false,
      customPath: searchParams.get("customPath") || "",
      customParams:
        searchParams.get("customParams") || credential?.customParams || "",
      isDistributed:
        searchParams.get("isDistributed") === "true" ||
        credential?.isDistributed ||
        false,
      clusterName:
        searchParams.get("clusterName") || credential?.clusterName || "",
    },
  });

  useEffect(() => {
    form.reset({
      connectionName: editingConnection?.name || "",
      environment: editingConnection?.environment || "dev",
      url: searchParams.get("url") || credential?.url || "",
      username: searchParams.get("username") || credential?.username || "",
      password: searchParams.get("password") || credential?.password || "",
      requestTimeout:
        Number(searchParams.get("requestTimeout")) ||
        credential?.requestTimeout ||
        30000,
      useAdvanced: searchParams.get("useAdvanced") === "true" || false,
      customPath: searchParams.get("customPath") || "",
      customParams:
        searchParams.get("customParams") || credential?.customParams || "",
      isDistributed:
        searchParams.get("isDistributed") === "true" ||
        credential?.isDistributed ||
        false,
      clusterName:
        searchParams.get("clusterName") || credential?.clusterName || "",
    });

    if (searchParams.get("useAdvanced") === "true")
      setShowAdvancedSettings(true);
    else setShowAdvancedSettings(false);
  }, [searchParams, credential, form.reset]);

  const onSubmit = async (values: FormData) => {
    try {
      let url = values.url;
      if (values.useAdvanced && values.customPath) {
        url = `${values.url}/${values.customPath}`;
      }

      const credentialToSave: Credential = {
        url,
        username: values.username,
        password: values.password || "",
        useAdvanced: values.useAdvanced || false,
        customPath: values.customPath || "",
        customParams: values.customParams?.trim() || "",
        requestTimeout: Number(values.requestTimeout), // Ensure type is number
        isDistributed: values.isDistributed || false,
        clusterName: values.clusterName || "",
      };

      let name = values.connectionName?.trim() || "";
      if (!name) {
        try {
          name = new URL(values.url).host;
        } catch {
          name = values.url;
        }
      }
      const id = editingId ?? `conn-${Date.now().toString(36)}`;
      saveConnection({
        id,
        name,
        environment: values.environment || "dev",
        credential: credentialToSave,
      });
      setEditingId(id);

      await setCredential(credentialToSave);
      await checkServerStatus();
      setCredentialSource("app");
      reinitializeMonacoClient();
    } catch (error) {
      toast.error("Error saving credentials: " + (error as Error).message);
    }
  };

  const resetFormTo = (conn?: SavedConnection) => {
    const c = conn?.credential;
    form.reset({
      connectionName: conn?.name || "",
      environment: conn?.environment || "dev",
      url: c?.url || "",
      username: c?.username || "",
      password: c?.password || "",
      requestTimeout: c?.requestTimeout || 30000,
      useAdvanced: c?.useAdvanced || false,
      customPath: c?.customPath || "",
      customParams: c?.customParams || "",
      isDistributed: c?.isDistributed || false,
      clusterName: c?.clusterName || "",
    });
    setShowAdvancedSettings(!!c?.useAdvanced);
    setShowDistributedSettings(!!c?.isDistributed);
  };

  const handleConnectSaved = async (id: string) => {
    const conn = savedConnections.find((c) => c.id === id);
    if (!conn) return;
    setEditingId(id);
    resetFormTo(conn);
    await switchConnection(id);
    reinitializeMonacoClient();
  };

  const handleEditSaved = (conn: SavedConnection) => {
    setEditingId(conn.id);
    resetFormTo(conn);
  };

  const handleNewConnection = () => {
    setEditingId(null);
    resetFormTo(undefined);
  };

  const handleDeleteSaved = (id: string) => {
    const confirmed = window.confirm("Delete this saved connection?");
    if (!confirmed) return;
    deleteConnection(id);
    if (editingId === id) setEditingId(null);
    toast.success("Connection deleted");
  };

  const handleDisconnect = () => {
    setEditingId(null);
    clearCredentials();
    form.reset({
      url: "",
      username: "",
      password: "",
      useAdvanced: false,
      customPath: "",
      requestTimeout: 30000,
    });
    toast.success("Disconnected from ClickHouse server.");
    navigate("/settings");
  };

  const handleTestConnection = async () => {
    try {
      await checkServerStatus();
      if (isServerAvailable && !error) {
        toast.success("Connection successful!", {
          description: "Successfully connected to ClickHouse server.",
        });
      } else if (error) {
        // Extract just the main error message for the toast (not the troubleshooting tips)
        const mainErrorMessage = error.split("\n\n")[0];
        toast.error(`Connection failed: ${mainErrorMessage}`, {
          description:
            "See the troubleshooting tips below for help resolving this issue.",
        });
      }
    } catch (err) {
      toast.error("Error testing connection", {
        description:
          "An unexpected error occurred while testing the connection.",
      });
    }
  };

  const handleShare = () => {
    const values = form.getValues();
    const params = new URLSearchParams();
    params.set("url", values.url);
    params.set("username", values.username);
    if (values.password) params.set("password", values.password);
    if (values.useAdvanced)
      params.set("useAdvanced", values.useAdvanced.toString());
    if (values.customPath) params.set("customPath", values.customPath);
    params.set("requestTimeout", String(values.requestTimeout));

    const url = `${window.location.origin}${
      window.location.pathname
    }?${params.toString()}`;

    navigator.clipboard.writeText(url);
    toast.success("URL copied to clipboard!");
  };

  const handleClearLocal = () => {
    const confirmed = window.confirm(
      "This will clear tabs and metrics layouts saved locally. Credentials are kept. Continue?"
    );
    if (!confirmed) return;
    clearLocalData();
    toast.success("Local data cleared");
  };

  return (
    <TooltipProvider>
      <div className="max-h-screen w-full overflow-y-auto">
        <div className="max-w-2xl mx-auto py-8">
          <div className="space-y-8">
            {shareLinkConnectionNotFound && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  That share link points to a ClickHouse connection that isn't saved here.
                </AlertDescription>
              </Alert>
            )}

            {credentialSource === "env" && (
              <Alert variant="info" className="mb-8">
                <AlertTitle className="flex items-center font-semibold">
                  <Server className="mr-2 h-4 w-4" />
                  Using Environment Variables
                </AlertTitle>
                <AlertDescription>
                  Your ClickHouse credentials are set using environment
                  variables. Please update your environment variables to change
                  the connection settings.
                  <hr className="my-4" />
                  <p className="text-sm">
                    You are connected to: {credential?.url}
                    <br />
                    User: {credential?.username}
                    <br />
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {credentialSource !== "env" && savedConnections.length > 0 && (
              <Card className="shadow-lg border-muted">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    <Database className="h-6 w-6 text-primary" />
                    Saved Connections
                  </CardTitle>
                  <CardDescription>
                    Switch between environments or edit a saved connection.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {savedConnections.map((conn) => (
                    <div
                      key={conn.id}
                      className={`flex items-center gap-3 rounded-md border p-3 ${
                        conn.id === activeConnectionId
                          ? "border-primary/50 bg-muted/50"
                          : ""
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                          ENV_DOT_CLASS[conn.environment]
                        }`}
                      />
                      <div className="min-w-0 flex-grow">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {conn.name}
                          </span>
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              ENV_BADGE_CLASS[conn.environment]
                            }`}
                          >
                            {ENV_LABEL[conn.environment]}
                          </span>
                          {conn.id === activeConnectionId &&
                            isServerAvailable && (
                              <Badge variant="secondary" className="shrink-0">
                                active
                              </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {conn.credential.url} · {conn.credential.username}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          isLoadingCredentials ||
                          (conn.id === activeConnectionId && isServerAvailable)
                        }
                        onClick={() => handleConnectSaved(conn.id)}
                      >
                        Connect
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEditSaved(conn)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit in the form below</TooltipContent>
                      </Tooltip>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteSaved(conn.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2"
                    onClick={handleNewConnection}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New connection
                  </Button>
                </CardContent>
              </Card>
            )}

            {credentialSource !== "env" && (
              <Card className="shadow-lg border-muted">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    <Settings className="h-6 w-6 text-primary" />
                    {editingConnection
                      ? `Connection Settings — ${editingConnection.name}`
                      : "New Connection"}
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(onSubmit)}
                      className="space-y-6"
                    >
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="connectionName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2">
                                  <Tag className="h-4 w-4" />
                                  Connection Name
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    disabled={isLoadingCredentials}
                                    placeholder="Local dev"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  Defaults to the host if left empty
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="environment"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Environment</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value || "dev"}
                                  disabled={isLoadingCredentials}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="dev" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {ENVIRONMENTS.map((env) => (
                                      <SelectItem key={env} value={env}>
                                        <span className="flex items-center gap-2">
                                          <span
                                            className={`h-2.5 w-2.5 rounded-full ${ENV_DOT_CLASS[env]}`}
                                          />
                                          {ENV_LABEL[env]}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormDescription className="text-xs">
                                  Colors the connection badge everywhere
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="url"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <Server className="h-4 w-4" />
                                ClickHouse Host
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="font-mono"
                                  disabled={isLoadingCredentials}
                                  placeholder="https://your-clickhouse-host:8123"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                The URL of your ClickHouse server, including
                                protocol and port
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                Username
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="font-mono"
                                  disabled={isLoadingCredentials}
                                  placeholder="default"
                                  autoComplete="username"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <Lock className="h-4 w-4" />
                                Password
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    className="font-mono pr-10"
                                    disabled={isLoadingCredentials}
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    {...field}
                                  />
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setShowPassword(!showPassword)
                                        }
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                                      >
                                        {showPassword ? (
                                          <EyeOff className="h-4 w-4" />
                                        ) : (
                                          <Eye className="h-4 w-4" />
                                        )}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {showPassword
                                        ? "Hide password"
                                        : "Show password"}
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Separator className="my-6" />

                        <FormField
                          control={form.control}
                          name="useAdvanced"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={(checked) => {
                                    setShowAdvancedSettings(checked as boolean);
                                    field.onChange(checked);
                                  }}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel className="flex items-center gap-2">
                                  <Cog className="h-4 w-4" />
                                  Advanced Settings
                                </FormLabel>
                                <FormDescription className="text-xs">
                                  Enable custom path handling for the ClickHouse
                                  URL
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />

                        {showAdvancedSettings && (
                          <FormField
                            control={form.control}
                            name="customPath"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Custom Path</FormLabel>
                                <FormControl>
                                  <Input
                                    className="font-mono"
                                    disabled={isLoadingCredentials}
                                    placeholder="clickhouse-{cluster_name}"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  Specify the custom path if you're using
                                  path-based routing
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        <FormField
                          control={form.control}
                          name="requestTimeout"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <FileClock className="h-4 w-4" />
                                Request Timeout (ms)
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="font-mono"
                                  disabled={isLoadingCredentials}
                                  type="number"
                                  min={1}
                                  max={600000}
                                  placeholder="30000"
                                  value={typeof field.value === "number" || typeof field.value === "string" ? field.value : ""}
                                  onChange={(e) =>
                                    field.onChange(e.target.value)
                                  }
                                  onBlur={field.onBlur}
                                  name={field.name}
                                  ref={field.ref}
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                Set the request timeout in milliseconds. Must be
                                between 1000 and 600000. (Default: 30000)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="customParams"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <Cog className="h-4 w-4" />
                                Custom Params
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="font-mono"
                                  disabled={isLoadingCredentials}
                                  placeholder="enable_analyzer=0&max_execution_time=300"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription className="text-xs">
                                ClickHouse settings applied to every query of
                                this connection: key=value pairs separated by
                                &amp;, comma or space
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="isDistributed"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={(checked) => {
                                    setShowDistributedSettings(
                                      checked as boolean
                                    );
                                    field.onChange(checked);
                                  }}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Distributed Mode</FormLabel>
                                <FormDescription className="text-xs">
                                  Enable this if you're using a ClickHouse
                                  cluster
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />

                        {showDistributedSettings && (
                          <FormField
                            control={form.control}
                            name="clusterName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Cluster Name</FormLabel>
                                <FormControl>
                                  <Input
                                    className="font-mono"
                                    disabled={isLoadingCredentials}
                                    placeholder="my_cluster"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  The name of your ClickHouse cluster
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </div>

                      <div className="flex gap-4 pt-4">
                        <Button
                          type="submit"
                          disabled={isLoadingCredentials}
                          className="w-40"
                        >
                          {isLoadingCredentials ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Connecting
                            </>
                          ) : (
                            "Save and Connect"
                          )}
                        </Button>

                        {isServerAvailable && (
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={handleDisconnect}
                            className="w-32"
                          >
                            <LogOut className="mr-2 h-4 w-4" />
                            Disconnect
                          </Button>
                        )}
                      </div>
                    </form>
                  </Form>
                </CardContent>

                {isServerAvailable ? (
                  <CardFooter className="border-t bg-muted/50 rounded-b-lg pt-4">
                    <div className="flex w-full justify-between items-center ">
                      <div className="space-x-4">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="secondary"
                                onClick={handleShare}
                                disabled={isLoadingCredentials}
                                size="icon"
                              >
                                <Share2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Share your current connection settings as a URL.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button
                          variant="outline"
                          onClick={handleTestConnection}
                          disabled={isLoadingCredentials}
                          className="w-40"
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Test Connection
                        </Button>
                      </div>
                      <span className="text-sm font-mono font-semibold text-green-500">
                        Server version: {version} - Connected
                      </span>
                    </div>
                  </CardFooter>
                ) : error ? (
                  <CardFooter className="border-t bg-muted/50 rounded-b-lg pt-4">
                    <div className="w-full">
                      <Alert variant="destructive" className="mb-4">
                        <AlertTitle className="flex items-center font-semibold text-red-500">
                          Connection Error
                        </AlertTitle>
                        <AlertDescription>
                          <div className="mt-2 space-y-4">
                            <p className="font-medium">
                              {error.split("\n\n")[0]}
                            </p>

                            {error.includes("Troubleshooting tips:") && (
                              <div className="mt-4">
                                <h4 className="font-medium mb-2">
                                  Troubleshooting Tips:
                                </h4>
                                <ul className="list-disc pl-5 space-y-1.5 text-sm">
                                  {error
                                    .split("Troubleshooting tips:\n")[1]
                                    ?.split("\n")
                                    .map((tip, index) => (
                                      <li key={index}>{tip}</li>
                                    ))}
                                </ul>
                              </div>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleTestConnection}
                              className="mt-4"
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Test Connection Again
                            </Button>
                          </div>
                        </AlertDescription>
                      </Alert>
                    </div>
                  </CardFooter>
                ) : null}
              </Card>
            )}

            {/* Local data management */}
            <Card className="shadow-lg border-muted">
              <CardHeader>
                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                  <Trash2 className="h-6 w-6 text-primary" />
                  Local Data
                </CardTitle>
                <CardDescription>
                  Clear tabs and dashboard layouts saved in this browser.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  This keeps your connection credentials. Use Disconnect to clear credentials.
                </p>
              </CardContent>
              <CardFooter className="border-t bg-muted/50 rounded-b-lg pt-4 flex justify-end">
                <Button variant="destructive" onClick={handleClearLocal}>
                  <Trash2 className="mr-2 h-4 w-4" /> Clear Local Data
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
