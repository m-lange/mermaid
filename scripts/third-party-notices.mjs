// Erzeugt dist/third-party-notices.txt mit allen installierten Produktionsabhängigkeiten
// (Name, Version, Lizenz, Repository und vollständiger Lizenztext).
//
//   node scripts/third-party-notices.mjs
//
// Grundlage: `npm ls --omit=dev --all --parseable` (dedupliziert nach name@version).
// Beendet sich mit Exit-Code 1, wenn für ein Paket keine Lizenz ermittelt werden kann.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outDir = resolve(root, "dist");
const outFile = resolve(outDir, "third-party-notices.txt");

const LICENSE_FILE_RE = /^(licen[cs]e|copying)(\b|[-_.].*)?$/i;
const PERMISSIVE_RE = /^(MIT|ISC|0BSD|BSD-\d-Clause|Apache-2\.0|Unlicense|BlueOak-1\.0\.0|CC0-1\.0|Python-2\.0)$/i;

function listPackageDirs() {
  let out;
  try {
    // Fester Befehlsstring (keine Argumente von außen) – funktioniert unter Windows (npm.cmd) und Linux
    out = execSync("npm ls --omit=dev --all --parseable", {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    // npm ls meldet z. B. bei "extraneous"/"invalid" einen Fehlercode, liefert aber trotzdem die Liste
    out = e.stdout?.toString() ?? "";
    if (!out.trim()) throw e;
    console.warn("Warnung: npm ls meldete Probleme:\n" + (e.stderr?.toString() ?? "").trim());
  }
  const rootNorm = resolve(root).toLowerCase();
  return out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((dir) => resolve(dir).toLowerCase() !== rootNorm);
}

function licenseFromPkg(pkg) {
  const { license, licenses } = pkg;
  if (typeof license === "string" && license.trim()) return license.trim();
  if (license && typeof license === "object" && license.type) return String(license.type);
  if (Array.isArray(licenses) && licenses.length) {
    const types = licenses.map((l) => (typeof l === "string" ? l : l?.type)).filter(Boolean);
    if (types.length) return types.length > 1 ? `(${types.join(" OR ")})` : types[0];
  }
  return null;
}

function detectLicense(text) {
  const t = text.replace(/\s+/g, " ");
  if (/Permission is hereby granted, free of charge/i.test(t)) return "MIT";
  if (/Permission to use, copy, modify, and\/or distribute this software for any purpose/i.test(t))
    return /provided that the above copyright notice/i.test(t) ? "ISC" : "0BSD";
  if (/Apache License,? Version 2\.0/i.test(t)) return "Apache-2.0";
  if (/Redistribution and use in source and binary forms/i.test(t))
    return /neither the name|names of its contributors/i.test(t) ? "BSD-3-Clause" : "BSD-2-Clause";
  if (/Mozilla Public License,? (Version|v\.?) ?2\.0/i.test(t)) return "MPL-2.0";
  if (/Eclipse Public License - v 2\.0/i.test(t)) return "EPL-2.0";
  if (/This is free and unencumbered software released into the public domain/i.test(t)) return "Unlicense";
  if (/GNU LESSER GENERAL PUBLIC LICENSE/i.test(t)) return "LGPL (see license text)";
  if (/GNU GENERAL PUBLIC LICENSE/i.test(t)) return "GPL (see license text)";
  return null;
}

function repoUrl(pkg) {
  let r = pkg.repository;
  if (!r) return pkg.homepage || null;
  if (typeof r === "object") r = r.url;
  if (!r) return pkg.homepage || null;
  r = String(r).trim();
  const short = /^(github:|gitlab:|bitbucket:)?([\w.-]+\/[\w.-]+)$/.exec(r);
  if (short) {
    const host = { "gitlab:": "gitlab.com", "bitbucket:": "bitbucket.org" }[short[1]] ?? "github.com";
    return `https://${host}/${short[2]}`;
  }
  return r.replace(/^git\+/, "").replace(/^git:\/\//, "https://").replace(/^ssh:\/\/git@/, "https://").replace(/\.git$/, "");
}

async function licenseFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && LICENSE_FILE_RE.test(e.name))
    .map((e) => e.name)
    .sort();
}

const seen = new Map();
for (const dir of listPackageDirs()) {
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  if (!pkg.name || !pkg.version) continue;
  const key = `${pkg.name}@${pkg.version}`;
  if (seen.has(key)) continue;

  const files = await licenseFiles(dir);
  const texts = [];
  for (const f of files) texts.push({ file: f, text: (await readFile(join(dir, f), "utf8")).trim() });

  let license = licenseFromPkg(pkg);
  let detected = false;
  if (!license) {
    for (const { text } of texts) {
      license = detectLicense(text);
      if (license) {
        detected = true;
        break;
      }
    }
  }
  seen.set(key, { name: pkg.name, version: pkg.version, license, detected, repo: repoUrl(pkg), texts });
}

const pkgs = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version, undefined, { numeric: true }));
const missing = pkgs.filter((p) => !p.license);

const rootPkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const rule = "=".repeat(80);
const thin = "-".repeat(80);
const lines = [
  "THIRD-PARTY SOFTWARE NOTICES AND INFORMATION",
  "",
  `Project:   Mermaid Editor for Word, Excel & PowerPoint (${rootPkg.name} ${rootPkg.version})`,
  `License:   ${rootPkg.license} (https://github.com/m-lange/mermaid/blob/main/LICENSE)`,
  `Generated: ${new Date().toISOString()}`,
  "",
  "This add-in includes the following third-party open-source components. Each component",
  "is licensed under its own license terms, reproduced below. \"Mermaid\" refers to the",
  "independent open-source project (https://mermaid.js.org); this add-in is not an official",
  "product of that project.",
  "",
  `Packages: ${pkgs.length}`,
  "",
  rule,
  "SUMMARY",
  rule,
  ...pkgs.map((p) => `${p.name}@${p.version}  —  ${p.license ?? "UNKNOWN"}`),
  "",
];

for (const p of pkgs) {
  lines.push(rule, `${p.name} ${p.version}`, rule);
  lines.push(`License:    ${p.license ?? "UNKNOWN"}${p.detected ? " (detected from license file)" : ""}`);
  if (p.repo) lines.push(`Repository: ${p.repo}`);
  lines.push("");
  if (p.texts.length) {
    for (const { file, text } of p.texts) {
      if (p.texts.length > 1) lines.push(`--- ${file} ---`, "");
      lines.push(text, "");
    }
  } else {
    lines.push(
      `No license file is included in this package. It is distributed under the terms of the`,
      `${p.license ?? "UNKNOWN"} license as declared in its package.json${p.repo ? `; see ${p.repo}` : ""}.`,
      "",
    );
  }
  lines.push(thin, "");
}

await mkdir(outDir, { recursive: true });
await writeFile(outFile, lines.join("\n"), "utf8");

const counts = new Map();
for (const p of pkgs) counts.set(p.license ?? "UNKNOWN", (counts.get(p.license ?? "UNKNOWN") ?? 0) + 1);
console.log(`dist/third-party-notices.txt geschrieben (${pkgs.length} Pakete).`);
console.log("Lizenzen:", [...counts].sort((a, b) => b[1] - a[1]).map(([l, n]) => `${l}: ${n}`).join(", "));
const nonPermissive = pkgs.filter((p) => p.license && !PERMISSIVE_RE.test(p.license.replace(/^\((.*)\)$/, "$1")));
if (nonPermissive.length) {
  console.log("Nicht (nur) permissive Lizenzen:");
  for (const p of nonPermissive) console.log(`  ${p.name}@${p.version}: ${p.license}`);
}
const noText = pkgs.filter((p) => !p.texts.length);
if (noText.length) console.log(`Ohne Lizenzdatei (${noText.length}): ${noText.map((p) => `${p.name}@${p.version}`).join(", ")}`);

if (missing.length) {
  console.error(`Keine Lizenz ermittelbar für: ${missing.map((p) => `${p.name}@${p.version}`).join(", ")}`);
  process.exit(1);
}
