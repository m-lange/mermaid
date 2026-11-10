/**
 * Sprachwahl des Add-ins. Unterstützt: Deutsch ("de") und Englisch ("en").
 * Deutsch wird verwendet, wenn die Office-Anzeigesprache Deutsch ist, sonst Englisch.
 */
export type Lang = "de" | "en";

let current: Lang = "en";

/** Setzt die Sprache anhand eines Sprachcodes wie "de-DE", "en-US", "fr-FR" */
export function setLanguage(code: string | undefined | null): Lang {
  current = code && code.toLowerCase().startsWith("de") ? "de" : "en";
  return current;
}

export function getLanguage(): Lang {
  return current;
}

/** Wählt den Wert für die aktuelle Sprache */
export function pick<T>(values: { de: T; en: T }): T {
  return values[current];
}
