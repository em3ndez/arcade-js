// SPDX-License-Identifier: GPL-3.0-only
// Pure token-rename for the understanding-pass name retrofit (runbook §4): loc_<addr> -> descriptive across
// one idiomatic file's text, guarding (a) any line importing from translated/ AND (b) any loc_ token BOUND
// to a translated import anywhere in the file -- its body usages are the frozen oracle, not the idiomatic
// name. Guarding only the import line renames body usages of a bare `import { loc_771d } from "../translated/"`
// into the descriptive name -> ReferenceError. `entries` = [[addrHex, { name }], ...]; returns { text, subs }.
export function renameFileText(text, entries) {
  const lines = text.split("\n");
  const translatedBound = new Set();
  for (const line of lines) {
    if (!line.includes("translated/")) continue;
    const im = line.match(/import\s*\{([^}]*)\}/);
    if (!im) continue;
    for (const tok of im[1].split(",")) {
      const parts = tok.trim().split(/\s+as\s+/);
      const local = (parts.length > 1 ? parts[1] : parts[0]).trim(); // the name the body actually uses
      if (/^loc_[0-9a-f]+$/.test(local)) translatedBound.add(local);
    }
  }
  let subs = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("translated/")) continue; // frozen oracle import line -- never touch
    for (const [a, v] of entries) {
      if (translatedBound.has(`loc_${a}`)) continue; // usage bound to a translated import -- leave loc_
      const re = new RegExp(`\\bloc_${a}\\b`, "g");
      const before = lines[i];
      lines[i] = lines[i].replace(re, v.name);
      if (lines[i] !== before) subs += (before.match(re) || []).length;
    }
  }
  return { text: lines.join("\n"), subs };
}
