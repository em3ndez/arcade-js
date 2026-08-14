// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderLivesRow — memory-equivalent to the frozen oracle at ROM 0x0A48.
 * GATE: crafted-entry. Attract never dispatches this board-setup render (probe: 0 dispatches over
 * ENTRY_FRAMES), so a post-boot attract machine is cloned and its count cell (0x83B7) poked to drive
 * each path — a short run, the clamp above 0x0F, and the zero->full-run djnz edge. The lives-row
 * column is pre-cleared so the fill is observable. The routine reads no live register and its
 * live-out is memory-only, so registers/SP are not compared. Teeth: three broken RAM twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { renderLivesRow } from "../renderLivesRow.js";
import { loc_0a48 as oracle } from "../../translated/loc_0a48.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const COUNT_CELL = 0x83b7;
const ROW_BASE = 0xa87e;
const ROW_STRIDE = 32;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

// A post-boot machine with a specific life/level count and a cleared lives-row column, so the
// oracle's marker writes are observable (a valid entry: this leaf reads its own count from RAM).
function entryWithCount(count) {
  const e = seedMachine().clone();
  e.mem8[COUNT_CELL] = count;
  let p = ROW_BASE;
  for (let i = 0; i < 16; i++) { e.mem8[p] = 0; p = (p + ROW_STRIDE) & 0xffff; }
  return e;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

const COUNTS = [5, 0x20, 0, 1, 15]; // normal, clamp path, zero->256 edge, min, at-cap

// broken twins, each leaving wrong RAM the diff must catch.
function brokenNoOp() {}
function brokenWrongTile(m) {
  const { mem8 } = m;
  const n = Math.min(mem8[COUNT_CELL], 15) || 256;
  let p = ROW_BASE;
  for (let i = 0; i < n; i++) { mem8[p] = 77; p = (p + ROW_STRIDE) & 0xffff; }
}
function brokenNoClamp(m) {
  const { mem8 } = m;
  const n = mem8[COUNT_CELL] || 256; // BUG: never clamps to 15
  let p = ROW_BASE;
  for (let i = 0; i < n; i++) { mem8[p] = 76; p = (p + ROW_STRIDE) & 0xffff; }
}

test("EQUAL (crafted): renderLivesRow == oracle on every count path", { skip }, () => {
  const entries = COUNTS.map(entryWithCount);
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (const e of entries) assert.equal(ramDiff(renderLivesRow, e), null, "a crafted entry diverged");
  // non-vacuous: the no-op twin diverging proves the oracle actually writes on the sample entry.
  assert.ok(ramDiff(brokenNoOp, entryWithCount(5)), "vacuous: oracle wrote nothing");
  console.log(`  EQUAL: ${entries.length} crafted count paths, renderLivesRow == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = entryWithCount(0x20); // clamp path: exercises count>15 and a full-length row
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongTile, e), "the wrong-tile twin escaped");
  assert.ok(ramDiff(brokenNoClamp, e), "the no-clamp twin escaped");
  console.log("  TEETH: no-op, wrong-tile, no-clamp all caught");
});
