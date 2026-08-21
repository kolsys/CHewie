/// <reference types="vite/client" />

declare const __CHEWIE_VERSION__: string;

declare global {
  interface Window {
    MonacoEnvironment?: {
      getWorkerUrl?: (moduleId: string, label: string) => string;
    };
  }
}