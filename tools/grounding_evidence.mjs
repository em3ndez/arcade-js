// SPDX-License-Identifier: GPL-3.0-only
//
// Extract the per-cert MAME evidence a GROUNDING reviewer needs to CONFIRM a [seen] from hardware,
// rather than infer it from the code diff (a MAME fact is absent from the diff, so a code-only review
// can only flag a [code]->[seen] promotion as unrecorded — never confirm it). Reads a gwtrace capture
// (the write-tap CSV the grounding harness produces under MAME: `pc,addr,n,v0,vN,cyc0`) and answers,
// for one cert under review:
//
//   routine <lo> <hi>   the routine's OWN write-set — every cell written at a PC inside [lo,hi). A
//                       role-defining own write here grounds the routine [seen]; a pure dispatcher that
//                       writes only its return-stack scratch cannot be [seen] from its own writes.
//   cell <addr>         the writes TO one cell — which PCs write it and the value transitions (v0->vN).
//                       A watched value change (drain/toggle/seed) grounds the cell [seen].
//
// This is the tool the grounding-commit-review workflow hands each reviewer per cert (docs/runbook.md
// §4 "The grounding CONFIRMER confirms a [seen] from EVIDENCE"; docs/reviewer-rules.md R38 [U]). The
// gwtrace capture is ROM-derived and per-session (never committed); regenerate it with the game's
// grounding write-tap (games/<game>/tools/lua/ground_writes.lua) under the MAME rig.
// Run: node tools/grounding_evidence.mjs <gwtrace.csv> <game> routine 0x6505 0x6523
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const hx = (v) => "0x" + (v & 0xffffff).toString(16);

// The dead return-stack window is PER-GAME — read it from the game's names.js STACK_SCRATCH, never a
// hardcoded constant (a wrong band mis-labels game-state cells as scratch and demotes real groundings).
export async function stackWindow(game) {
  const url = pathToFileURL(`${process.cwd()}/games/${game}/idiomatic/names.js`).href;
  const { STACK_SCRATCH } = await import(url);
  if (!STACK_SCRATCH || typeof STACK_SCRATCH.lo !== "number") {
    throw new Error(`games/${game}/idiomatic/names.js has no numeric STACK_SCRATCH {lo,hi}`);
  }
  return STACK_SCRATCH;
}

export function parseGwtrace(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    const c = line.split(",");
    if (c.length < 5 || c[0] === "pc") continue;
    const pc = parseInt(c[0], 16), addr = parseInt(c[1], 16), n = parseInt(c[2], 10);
    const v0 = parseInt(c[3], 16), vN = parseInt(c[4], 16);
    if (Number.isNaN(pc) || Number.isNaN(addr)) continue;
    rows.push({ pc, addr, n, v0, vN });
  }
  return rows;
}

/** The write-set at a routine's own PCs: [{pc, addr, v0, vN, n, stack}], role-defining writes first.
 *  `stack` is the game's dead-return-stack window {lo,hi} (from stackWindow) — writes there are scratch. */
export function routineWrites(rows, lo, hi, stack, bulk = new Set()) {
  const out = rows.filter((r) => r.pc >= lo && r.pc < hi);
  const seen = new Map();
  for (const r of out) {
    const k = r.pc + ":" + r.addr;
    const e = seen.get(k);
    if (!e) seen.set(k, { ...r, stack: r.addr >= stack.lo && r.addr < stack.hi, bulk: bulk.has(r.pc) });
    else e.n += r.n;
  }
  return [...seen.values()].sort((a, b) => Number(a.stack || a.bulk) - Number(b.stack || b.bulk) || b.n - a.n);
}

/** The writes to one cell: [{pc, v0, vN, n, changed, bulk}], value-changing writes first. */
export function cellWrites(rows, addr, bulk = new Set()) {
  const out = rows.filter((r) => r.addr === addr);
  const seen = new Map();
  for (const r of out) {
    const k = r.pc + ":" + r.v0 + ":" + r.vN;
    const e = seen.get(k);
    if (!e) seen.set(k, { pc: r.pc, v0: r.v0, vN: r.vN, n: r.n, changed: r.v0 !== r.vN, bulk: bulk.has(r.pc) });
    else e.n += r.n;
  }
  return [...seen.values()].sort((a, b) => Number(b.changed) - Number(a.changed) || b.n - a.n);
}

/** PCs that are a block-copy / fill-with-varied-bytes / sweep (an LDIR memcpy), NOT a role write: a
 *  single instruction that writes MANY distinct cells with MANY distinct values. Their write to any one
 *  cell is a COPIED byte, so counting it as a value-transition manufactures a false [seen] (the write-side
 *  analogue of the ROM-checksum sweep the runbook excludes from read-grounding: "one PC that reads
 *  hundreds of addresses grounds nothing role-specific"). A genuine role PC writes a handful of cells; a
 *  legitimate FILL writes many cells but ONE value (so it is kept — the fill IS its role) — hence the
 *  value-fanout gate distinguishes a memcpy from a fill. */
export function bulkCopyPCs(rows, cellThreshold = 32, valThreshold = 4) {
  const byPC = new Map();
  for (const r of rows) {
    let e = byPC.get(r.pc);
    if (!e) byPC.set(r.pc, (e = { cells: new Set(), vals: new Set() }));
    e.cells.add(r.addr); e.vals.add(r.v0); e.vals.add(r.vN);
  }
  const bulk = new Set();
  for (const [pc, e] of byPC) if (e.cells.size >= cellThreshold && e.vals.size >= valThreshold) bulk.add(pc);
  return bulk;
}

async function main(argv) {
  const [csv, game, mode, a, b] = argv;
  if (!csv || !game || !mode) {
    console.error("usage: grounding_evidence.mjs <gwtrace.csv> <game> routine <lo> <hi> | cell <addr>");
    return 2;
  }
  const rows = parseGwtrace(readFileSync(csv, "utf8"));
  const stack = await stackWindow(game);
  const bulk = bulkCopyPCs(rows);
  if (mode === "routine") {
    const lo = parseInt(a, 16), hi = parseInt(b, 16);
    const w = routineWrites(rows, lo, hi, stack, bulk);
    const own = w.filter((r) => !r.stack && !r.bulk);
    console.log(`routine [${hx(lo)},${hx(hi)}) [${game}, stack ${hx(stack.lo)}-${hx(stack.hi)}]: ${own.length} own-cell write(s), ${w.filter((r) => r.stack).length} stack-scratch, ${w.filter((r) => r.bulk).length} bulk-copy`);
    for (const r of w) console.log(`  pc ${hx(r.pc)} -> ${hx(r.addr)}  ${hx(r.v0)}->${hx(r.vN)}  n=${r.n}${r.stack ? "  [stack scratch — not role-defining]" : r.bulk ? "  [bulk-copy PC — a copied byte, not role-defining]" : ""}`);
    if (!own.length) console.log("  (no OWN role-defining write — a writer is not [seen] from writes here; a DISPATCHER/driver instead grounds on observed reachability + correct vectoring — check its dispatch-cell + handler certs)");
  } else if (mode === "cell") {
    const addr = parseInt(a, 16);
    const w = cellWrites(rows, addr, bulk);
    // Exclude bulk-copy PCs: their write is a copied byte, not a role write, so it must not count toward
    // an in-write change OR a cross-PC value spread (else a memcpy manufactures a false [seen]).
    const chg = w.filter((r) => r.changed && !r.bulk);
    // A state cell advanced by DIFFERENT role PCs (each writing a constant) shows no per-write change but a
    // SPREAD of distinct values across the write-sites — that is still watched-changing, hence groundable.
    const vals = new Set();
    for (const r of w) { if (!r.bulk) { vals.add(r.v0); vals.add(r.vN); } }
    const grounded = chg.length > 0 || vals.size > 1;
    const nbulk = w.filter((r) => r.bulk).length;
    console.log(`cell ${hx(addr)}: ${chg.length} in-write change(s), ${vals.size} distinct role value(s) across ${w.length - nbulk} role write-site(s)${nbulk ? ` (+${nbulk} bulk-copy, excluded)` : ""}`);
    for (const r of w) console.log(`  pc ${hx(r.pc)}  ${hx(r.v0)}->${hx(r.vN)}  n=${r.n}${r.changed ? "" : "  [no in-write change]"}${r.bulk ? "  [bulk-copy PC — excluded from grounding]" : ""}`);
    if (!grounded) console.log("  (a single constant value, never watched changing by a role write — this cell is not [seen] from this capture)");
    else if (!chg.length) console.log(`  (${vals.size} distinct values written across role PCs -> watched changing, [seen]-groundable even though each write is a constant)`);
  } else {
    console.error(`unknown mode ${mode}`);
    return 2;
  }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(await main(process.argv.slice(2)));
