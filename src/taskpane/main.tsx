import { createRoot } from "react-dom/client";
import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { App } from "./App";
import type { HostAdapter } from "../office/hostAdapter";
import { BrowserAdapter } from "../office/browserAdapter";
import "./styles.css";

async function createAdapter(host: Office.HostType | null | undefined): Promise<HostAdapter> {
  switch (host) {
    case Office.HostType.Word: {
      const { WordAdapter } = await import("../office/wordAdapter");
      return new WordAdapter();
    }
    case Office.HostType.Excel: {
      const { ExcelAdapter } = await import("../office/excelAdapter");
      return new ExcelAdapter();
    }
    case Office.HostType.PowerPoint: {
      const { PowerPointAdapter } = await import("../office/powerpointAdapter");
      return new PowerPointAdapter();
    }
    default:
      return new BrowserAdapter();
  }
}

function isDarkOfficeTheme(): boolean {
  try {
    const bg = Office.context?.officeTheme?.bodyBackgroundColor;
    if (bg) {
      const hex = bg.replace("#", "");
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.substring(i, i + 2), 16));
      return 0.299 * r + 0.587 * g + 0.114 * b < 128;
    }
  } catch {
    /* officeTheme nicht verfügbar */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function render(adapter: HostAdapter) {
  // Nur im Browser-Modus: simuliertes Dokument für automatisierte Tests erreichbar machen
  if (adapter instanceof BrowserAdapter) (window as unknown as { mermaidBrowserDoc: BrowserAdapter }).mermaidBrowserDoc = adapter;
  const root = createRoot(document.getElementById("root")!);
  const Root = () => {
    const dark = isDarkOfficeTheme();
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    return (
      <FluentProvider theme={dark ? webDarkTheme : webLightTheme} style={{ height: "100%" }}>
        <App adapter={adapter} dark={dark} />
      </FluentProvider>
    );
  };
  root.render(<Root />);
}

const officeAvailable = typeof Office !== "undefined" && typeof Office.onReady === "function";

if (officeAvailable) {
  // Außerhalb von Office ruft onReady mit host = null zurück
  Office.onReady(async (info) => render(await createAdapter(info.host)));
} else {
  render(new BrowserAdapter());
}
