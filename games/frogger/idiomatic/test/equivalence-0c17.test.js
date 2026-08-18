// SPDX-License-Identifier: GPL-3.0-only
/**
 * blitMode3FinalStrip — crafted-entry equivalence vs the frozen oracle for the mode-3 score-ranking
 * final-strip tail. The routine sets its own registers, so any coherent post-boot clone is a valid
 * entry once the VRAM column is pre-cleared and the strip-state cell set nonzero. RAM compared, dead
 * stack scratch masked. Teeth: no-op, wrong-state, skip-blit, short-blit; plus a load-bearing control.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { blitMode3FinalStrip } from "../blitMode3FinalStrip.js";
import { loc_0c17 as oracle } from "../../translated/loc_0bb3.js";
import { copyRunUpTileColumn } from "../copyRunUpTileColumn.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const STRIP_STATE = 0x8039; // mode-3 strip state cell, zeroed before the blit
const STRIP_VRAM = 0xaafc; // blit dest; steps up one 0x20-cell row per tile
const STRIP_SRC = 0x2f4d; // ROM source of the 15-tile strip
const STRIP_LEN = 0x0f; // 15 tiles
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// the 15 VRAM cells the strip lands in (dest steps back one 32-cell tilemap row per tile).
function stripCells() {
  const cells = [];
  for (let i = 0, a = STRIP_VRAM; i < STRIP_LEN; i++, a = (a - 32) & 0xffff) cells.push(a);
  return cells;
}

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

// pre-clear the target column and set the state cell nonzero so both writes are observable.
function entry() {
  const e = seedMachine().clone();
  for (const a of stripCells()) e.mem8[a] = 0;
  e.mem8[STRIP_STATE] = 0xff;
  return e;
}

// null == RAM-equivalent, masking the dead stack scratch below the entry SP. Memory-only: no regs/SP.
function ramDiff(cand, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const da = a.dumpState(), db = b.dumpState();
  for (let k = 1; k <= 8; k++) {
    const addr = (sp - k) & 0xffff;
    if (addr >= 0x8000 && addr <= 0x87ff) { const o = addr - 0x8000; da[o] = 0; db[o] = 0; }
  }
  const d = firstStateDiff(da, db, (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

function brokenNoOp() {}
// full correct blit, but leaves the strip state cell nonzero instead of zeroing it.
function brokenWrongState(m) { blitMode3FinalStrip(m); m.mem8[STRIP_STATE] = 1; }
// zeroes the state cell but never blits the strip.
function brokenSkipBlit(m) { m.mem8[STRIP_STATE] = 0; }
// blits one tile short of the full strip (top tile missing).
function brokenShortBlit(m) {
  m.mem8[STRIP_STATE] = 0;
  copyRunUpTileColumn(m, STRIP_VRAM, STRIP_SRC, STRIP_LEN - 1);
}

test("EQUAL (crafted): blitMode3FinalStrip == oracle", { skip }, () => {
  const e = entry();
  assert.equal(ramDiff(blitMode3FinalStrip, e), null, "the crafted entry diverged");
  // non-vacuous: the no-op twin diverging proves the oracle actually writes.
  assert.ok(ramDiff(brokenNoOp, entry()), "vacuous: oracle wrote nothing");
  // positive control: the oracle paints observable tiles over the cleared column (blit is load-bearing).
  const oc = entry(); oracle(oc);
  assert.ok(stripCells().some((a) => oc.mem8[a] !== 0), "oracle wrote no observable tile into the cleared column");
  console.log("  EQUAL: crafted mode-3 final-strip tail, blitMode3FinalStrip == oracle");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = entry();
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongState, e), "the wrong-state twin escaped");
  assert.ok(ramDiff(brokenSkipBlit, e), "the skip-blit twin escaped");
  assert.ok(ramDiff(brokenShortBlit, e), "the short-blit twin escaped");
  console.log("  TEETH: no-op, wrong-state, skip-blit, short-blit all caught");
});
