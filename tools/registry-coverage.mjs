// SPDX-License-Identifier: GPL-3.0-only
//
// The wiring invariant, as a game-agnostic scan: a module is DISPATCHED only if a ROUTINES entry
// names it, because `resolveAllIdiomatic` builds the override map by walking ROUTINES. An unwired
// module is not overridden, so every dispatch to its address runs the frozen oracle instead, and
// the rewrite is reached only by a sibling that imports it directly -- for many, by nothing but
// its own gate. No per-routine gate can see this: a gate imports its module rather than
// dispatching to it, so it passes either way.
//
// ★ EVERYTHING HERE IS READ FROM THE INDEX -- the module list, each module's text, and the
// registry itself -- so every check speaks about one revision. A module still being written trips
// nothing; a STAGED one trips at once, the moment the defect is created; a committed one stays red
// until wired or recorded; and a registry entry staged without its module fails too, which is the
// shape that breaks `resolveAllIdiomatic` for a whole game on a fresh clone. Every git failure
// throws: a scan that cannot read the index is not a clean scan.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

// NARROWER THAN THE RESOLVER, and it says so instead of covering the gap: `resolveOverrides` does
// `mod[entry]` after a dynamic import, so it takes any export shape, while these two read plain
// declarations only. So the gap is closed by REPORTING -- a statement neither decides fails as
// `unclassified`, because filing an unknown shape under support exempts an unwired module silently.
const FN = "(?:async\\s+)?function\\b|(?:const|let|var)\\s+[A-Za-z_$][\\w$]*\\s*=\\s*(?:async\\s*)?(?:function\\b|\\(|[A-Za-z_$][\\w$]*\\s*=>)";
const ROUTINE_EXPORT = new RegExp(`^export\\s+(?:${FN})`);
const DATA_EXPORT = /^export\s+(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=/;

/** What git has in its index for `dir`, relative to it. Throws rather than reporting none. */
export function trackedPaths(dir, pathspec = []) {
  try {
    const args = ["ls-files", "--cached", "-z", "--", ...pathspec];
    const out = execFileSync("git", args, { cwd: dir, encoding: "utf8" });
    return out.split("\0").filter(Boolean);
  } catch (e) {
    throw new Error(`git ls-files failed in ${dir}: ${e.stderr || e.message}`);
  }
}

/**
 * The INDEX text of each named path, in one batch. A path git cannot resolve throws: this is the
 * seam where a silent empty read would turn every later check into a vacuous pass.
 */
export function indexBlobs(dir, rels) {
  if (rels.length === 0) return new Map();
  let out;
  try {
    out = execFileSync("git", ["cat-file", "--batch"], {
      cwd: dir,
      input: rels.map((r) => `:./${r}`).join("\n") + "\n",
      maxBuffer: 512 * 1024 * 1024,
    });
  } catch (e) {
    throw new Error(`git cat-file failed in ${dir}: ${e.stderr || e.message}`);
  }
  const blobs = new Map();
  let at = 0;
  for (const rel of rels) {
    const nl = out.indexOf(0x0a, at);
    const header = nl < 0 ? "(truncated)" : out.toString("utf8", at, nl);
    const size = /^[0-9a-f]{40,64} blob (\d+)$/.exec(header);
    if (!size) throw new Error(`git cat-file could not read ${rel} in ${dir}: ${header}`);
    blobs.set(rel, out.toString("utf8", nl + 1, nl + 1 + Number(size[1])));
    at = nl + 1 + Number(size[1]) + 1;
  }
  return blobs;
}

/**
 * The tracked flat top level of one game's idiomatic layer, split THREE ways by reading each
 * top-level export statement: a routine to wire, pure data that no entry could name -- the
 * registry, a table of RAM names -- and a shape this cannot decide, which is neither and is
 * returned rather than absorbed. Only the top level counts; the resolver builds a flat path.
 */
export function indexedModules(idiomaticDir) {
  const rels = trackedPaths(idiomaticDir).filter((r) => !r.includes("/") && r.endsWith(".js"));
  const blobs = indexBlobs(idiomaticDir, rels);
  const modules = [];
  const support = [];
  const unclassified = [];
  for (const rel of rels) {
    // Per statement, not per line, so a declaration spread over several lines is read whole.
    const shapes = blobs
      .get(rel)
      .split(/^(?=export\b)/m)
      .filter((chunk) => chunk.startsWith("export"))
      .map((chunk) => (ROUTINE_EXPORT.test(chunk) ? "routine" : DATA_EXPORT.test(chunk) ? "data" : "?"));
    if (shapes.includes("?")) unclassified.push(rel);
    else if (shapes.includes("routine")) modules.push(rel);
    else support.push(rel);
  }
  return { modules: modules.sort(), support: support.sort(), unclassified: unclassified.sort(), blobs };
}

/**
 * One game's ROUTINES map as the INDEX holds it, so the registry and the modules it names are read
 * at the same revision. Null when no registry is tracked yet, which is a game that has not landed.
 */
export async function loadRoutinesFromIndex(idiomaticDir) {
  if (!trackedPaths(idiomaticDir).includes("names.js")) return null;
  const src = indexBlobs(idiomaticDir, ["names.js"]).get("names.js");
  const { ROUTINES } = await import(
    `data:text/javascript;base64,${Buffer.from(src, "utf8").toString("base64")}`
  );
  return ROUTINES;
}

/**
 * A game's declared runtime, from the index. REPORTED, never asserted on: a game can be fully
 * wired and still switched off here, and `"translated"` is an accurate declaration rather than a
 * defect, so a gate that fired on it would be a gate people learn to ignore.
 */
export async function runtimeFromIndex(gameDir) {
  if (!trackedPaths(gameDir, ["manifest.js"]).includes("manifest.js")) return null;
  const src = indexBlobs(gameDir, ["manifest.js"]).get("manifest.js");
  const m = await import(`data:text/javascript;base64,${Buffer.from(src, "utf8").toString("base64")}`);
  return m.default?.runtime ?? null;
}

/** Modules in the directory that the index does not hold — reported, never failed on. */
export function untrackedModules(idiomaticDir) {
  const tracked = new Set(trackedPaths(idiomaticDir));
  return readdirSync(idiomaticDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".js") && !tracked.has(e.name))
    .map((e) => e.name)
    .sort();
}

/**
 * Both directions of the wiring, over one revision of the layer.
 *
 * `unwired` -- tracked modules no entry names, so nothing dispatches them.
 * `unresolvable` -- entries whose module is absent from the index, or present without the export
 * the resolver asks for. Either way building the override map throws for the whole game.
 * `unclassified` -- modules whose export shape neither regex decides. Failed on, not filed as support.
 */
export function findWiringGaps(idiomaticDir, routines) {
  const { modules, support, unclassified, blobs } = indexedModules(idiomaticDir);
  const shapeless = new Set(unclassified);
  const wired = new Set();
  const unresolvable = [];
  for (const [addr, meta] of Object.entries(routines)) {
    const file = `${meta.name}.js`;
    wired.add(file);
    const at = `0x${Number(addr).toString(16).padStart(4, "0")}`;
    if (!blobs.has(file)) {
      unresolvable.push(`${at} -> ${file} (not in the index)`);
      continue;
    }
    // Already reported by its shape, and this regex cannot read it either.
    if (shapeless.has(file)) continue;
    const wanted = meta.entry ?? meta.name;
    const exported = new RegExp(
      `export\\s+(?:async\\s+)?function\\s*\\*?\\s*\\b${wanted}\\b` +
        `|export\\s+(?:const|let|var)\\s+${wanted}\\b`,
    );
    if (!exported.test(blobs.get(file))) unresolvable.push(`${at} -> ${file} (exports no ${wanted})`);
  }
  return { unwired: modules.filter((f) => !wired.has(f)), unresolvable, unclassified, modules, support };
}
