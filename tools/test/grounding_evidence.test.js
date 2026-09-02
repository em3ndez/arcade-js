// SPDX-License-Identifier: GPL-3.0-only
//
// Tests tools/grounding_evidence.mjs — the per-cert MAME-evidence extractor a grounding reviewer uses
// to CONFIRM a [seen] from hardware (docs/reviewer-rules.md R38 [U]).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGwtrace, routineWrites, cellWrites, stackWindow, bulkCopyPCs } from "../grounding_evidence.mjs";

// pooyan's real dead-return-stack window (games/pooyan/idiomatic/names.js STACK_SCRATCH). The tool reads
// this per-game; the tests pin the boundary so a wrong band (e.g. 0x8f00) is caught by mutation.
const STACK = { lo: 0x8fc0, hi: 0x9000 };

// A synthetic gwtrace: a routine at [0x6505,0x6523) that writes a game cell (0x8929) AND return-stack
// scratch (0x8fda); a pure dispatcher at [0x66f1,0x66fd) that writes ONLY stack scratch; a cell (0x8929)
// that both changes value and gets a same-value write; and a driver at [0x2778,0x2790) whose one write
// is a WAVE-STATE cell (0x8f30 LAUNCH_STATE) that sits BELOW a buggy 0x8f00 stack floor but is real state.
const CSV = [
  "pc,addr,n,v0,vN,cyc0",
  "6508,8929,3,1c,1c,100", // 0x6505 seeds 0x8929 (own game-cell write)
  "6546,8929,8,1c,1a,200", // 0x6523 decrements 0x8929 (value change)
  "6519,8fda,4,00,65,300", // 0x6505 pushes return -> stack scratch (0x8fda in [0x8fc0,0x9000))
  "66f5,8fdc,2,00,66,400", // 0x66f1 pure dispatcher: only stack scratch
  "6600,8929,1,1a,1a,500", // some routine touches 0x8929 without changing it
  "2780,8f30,5,00,02,600", // 0x2778 driver advances LAUNCH_STATE (0x8f30) — a real state write, NOT stack
  "2273,8f38,1,00,00,700", // WAVE_OUTER_PHASE (0x8f38) set to 0 by one PC (a constant per write)
  "2825,8f38,1,01,01,800", // ... and to 1 by another PC — a value SPREAD across PCs, no in-write change
].join("\n");

const rows = parseGwtrace(CSV);

test("parseGwtrace skips the header and bad lines", () => {
  assert.equal(rows.length, 8);
  assert.equal(rows[0].pc, 0x6508);
  assert.equal(rows[0].addr, 0x8929);
});

test("routineWrites separates a routine's OWN game-cell write from stack scratch", () => {
  const w = routineWrites(rows, 0x6505, 0x6523, STACK); // 0x6508 (game cell) + 0x6519 (stack)
  const own = w.filter((r) => !r.stack);
  assert.equal(own.length, 1, "0x6505 has exactly one own game-cell write (0x8929)");
  assert.equal(own[0].addr, 0x8929);
  assert.ok(w.some((r) => r.stack && r.addr === 0x8fda), "the return-stack write is flagged as scratch");
  assert.equal(own[0].stack, false, "own writes sort before stack scratch");
});

test("routineWrites shows a pure dispatcher has NO own role-defining write", () => {
  const w = routineWrites(rows, 0x66f1, 0x66fd, STACK); // only 0x66f5 -> stack scratch
  const own = w.filter((r) => !r.stack);
  assert.equal(own.length, 0, "a pure dispatcher writes only stack scratch -> no OWN write (it grounds on vectoring)");
});

// ★ Load-bearing: pins the stack window. 0x8f30 (LAUNCH_STATE) sits below a wrong 0x8f00 floor but above
// the real 0x8fc0 one, so a wrong band would mis-report this state write as scratch and demote the driver.
test("routineWrites treats a wave-state cell (0x8f30) as an OWN write, NOT stack (pins the 0x8fc0 floor)", () => {
  const w = routineWrites(rows, 0x2778, 0x2790, STACK);
  const own = w.filter((r) => !r.stack);
  assert.equal(own.length, 1, "the driver's LAUNCH_STATE write is a real OWN role-defining write");
  assert.equal(own[0].addr, 0x8f30);
  assert.equal(own[0].stack, false, "0x8f30 is game state, not return-stack scratch");
  // Mutation guard: with a buggy floor of 0x8f00 this write would flip to stack.
  const buggy = routineWrites(rows, 0x2778, 0x2790, { lo: 0x8f00, hi: 0x9000 });
  assert.ok(buggy[0].stack, "control: a 0x8f00 floor WOULD (wrongly) call 0x8f30 stack — the bug this pins against");
});

test("stackWindow reads the per-game STACK_SCRATCH from names.js (guards the source, not a literal)", async () => {
  const s = await stackWindow("pooyan");
  assert.deepEqual(s, { lo: 0x8fc0, hi: 0x9000 }, "pooyan's dead-stack window is 0x8fc0-0x9000 per names.js");
  // A wrong hardcode (0x8f00) inside stackWindow() fails HERE, catching the exact original bug class.
});

test("a state cell written by different PCs with different constants is watched-changing (cross-PC spread)", () => {
  const w = cellWrites(rows, 0x8f38); // written 0 by pc 0x2273, 1 by pc 0x2825 — each a constant
  const chg = w.filter((r) => r.changed);
  const vals = new Set();
  for (const r of w) { vals.add(r.v0); vals.add(r.vN); }
  assert.equal(chg.length, 0, "no single write changes the cell in-place (each is a constant)");
  assert.ok(vals.size > 1, "but the distinct values across PCs (0 and 1) mean the cell IS watched changing -> groundable");
});

test("cellWrites: exactly one watched value change grounds the cell", () => {
  const w = cellWrites(rows, 0x8929);
  const chg = w.filter((r) => r.changed);
  assert.equal(chg.length, 1, "only the decrement 0x1c->0x1a is a value change");
  assert.equal(chg[0].pc, 0x6546);
  assert.ok(chg[0].changed && chg[0].v0 === 0x1c && chg[0].vN === 0x1a);
  assert.equal(w[0].changed, true, "the value-changing write sorts first");
});

// ── Bulk-copy exclusion (the write-side analogue of the ROM-checksum-sweep exclusion). A memcpy PC
// writes MANY cells with MANY values; a FILL writes many cells with ONE value; a role PC writes a few.
// Only the memcpy's per-cell write is a copied byte that must not fake a [seen]. This pins the exact
// escaped defect an R38 confirmer caught by hand: a cell's [code]->[seen] "value spread" that was really
// a block-copy artifact (loc_1a32 pc 0x1a34 wrote 608 cells).
const BULK_CSV = [
  "pc,addr,n,v0,vN,cyc0",
  // 0x1a34 = an LDIR memcpy: 40 distinct cells with varied bytes -> a bulk-copy PC (writes 0x8210=0x10).
  ...Array.from({ length: 40 }, (_, i) => `1a34,${(0x8200 + i).toString(16)},1,${(i % 17).toString(16)},${(i % 17).toString(16)},0`),
  // 0x2500 = a FILL: 40 distinct cells, ONE value (0x01) -> NOT bulk-copy (the fill IS its role).
  ...Array.from({ length: 40 }, (_, i) => `2500,${(0x8300 + i).toString(16)},1,1,1,0`),
  // cell 0x8210's SOLE role write is a constant 0x34 (pc 0x1792); the memcpy also wrote it 0x10.
  "1792,8210,30,34,34,0",
].join("\n");
const brows = parseGwtrace(BULK_CSV);

test("bulkCopyPCs flags a memcpy (many cells, many values) but NOT a fill (many cells, one value)", () => {
  const bulk = bulkCopyPCs(brows);
  assert.ok(bulk.has(0x1a34), "the 40-cell varied-value memcpy PC is bulk-copy");
  assert.ok(!bulk.has(0x2500), "the 40-cell single-value FILL is NOT bulk-copy (the fill is its role)");
  assert.ok(!bulk.has(0x1792), "a role PC writing one cell is not bulk-copy");
});

test("a cell whose only value-spread comes from a bulk-copy PC is NOT grounded (kills the false [seen])", () => {
  const bulk = bulkCopyPCs(brows);
  const w = cellWrites(brows, 0x8210, bulk);
  const roleVals = new Set();
  for (const r of w) if (!r.bulk) { roleVals.add(r.v0); roleVals.add(r.vN); }
  assert.equal(w.filter((r) => r.changed && !r.bulk).length, 0, "no role write changes it");
  assert.equal(roleVals.size, 1, "excluding the memcpy, only the constant role value 0x34 remains -> NOT groundable");
  // Mutation guard: WITHOUT the exclusion the memcpy's 0x10 fakes a 2-value spread -> the false [seen].
  const allVals = new Set();
  for (const r of cellWrites(brows, 0x8210)) { allVals.add(r.v0); allVals.add(r.vN); }
  assert.ok(allVals.size > 1, "control: without exclusion the memcpy byte fakes a spread — the bug this fix kills");
});

test("routineWrites flags a bulk-copy PC's write as NOT role-defining", () => {
  const bulk = bulkCopyPCs(brows);
  const w = routineWrites(brows, 0x1a34, 0x1a35, { lo: 0x8fc0, hi: 0x9000 }, bulk); // the memcpy PC's own range
  assert.ok(w.length > 0 && w.every((r) => r.bulk), "every write from the memcpy PC is flagged bulk-copy");
  assert.equal(w.filter((r) => !r.stack && !r.bulk).length, 0, "so the routine has NO role-defining own write here");
});
