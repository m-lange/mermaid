import { defineConfig, type ServerOptions } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

/** HTTPS-Zertifikate für localhost (Office verlangt HTTPS) */
async function httpsOptions(): Promise<ServerOptions["https"]> {
  try {
    const devCerts = await import("office-addin-dev-certs");
    const api = (devCerts as unknown as { default?: typeof devCerts }).default ?? devCerts;
    return await api.getHttpsServerOptions();
  } catch (e) {
    console.warn(
      "\n⚠  Keine Entwicklerzertifikate gefunden – bitte einmalig `npm run certs` ausführen.\n",
      (e as Error).message,
    );
    return undefined;
  }
}

export default defineConfig(async ({ command }) => ({
  root: resolve(import.meta.dirname, "src"),
  publicDir: resolve(import.meta.dirname, "public"),
  base: "./",
  plugins: [react()],
  // Alle Abhängigkeiten vorab bündeln: sonst entdeckt Vite sie erst zur Laufzeit
  // (z. B. per dynamischem Import) und lädt die Seite mitten in der Arbeit neu.
  optimizeDeps: {
    entries: ["taskpane/taskpane.html", "commands/commands.html", "dev/render-test.html"],
    include: [
      "react",
      "react-dom/client",
      "@fluentui/react-components",
      "@fluentui/react-icons",
      "mermaid",
      "@mermaid-js/layout-elk",
      "fflate",
      "@codemirror/state",
      "@codemirror/view",
      "@codemirror/commands",
      "@codemirror/language",
      "@codemirror/autocomplete",
      "@codemirror/search",
      "@lezer/highlight",
    ],
  },
  server: {
    port: 3000,
    strictPort: true,
    https: command === "serve" ? await httpsOptions() : undefined,
    headers: { "Access-Control-Allow-Origin": "*" },
  },
  preview: {
    port: 3000,
    strictPort: true,
    https: await httpsOptions(),
  },
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    target: "es2020",
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: {
        taskpane: resolve(import.meta.dirname, "src/taskpane/taskpane.html"),
        commands: resolve(import.meta.dirname, "src/commands/commands.html"),
      },
    },
  },
}));
