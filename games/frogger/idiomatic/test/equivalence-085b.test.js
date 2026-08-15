// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_085b — memory-equivalent to the frozen oracle at ROM 0x085B.
 * GATE: crafted-entry. Attract never dispatches this no-more-frogs tail (probe: 0 over ENTRY_FRAMES;
 * its sole caller is the score driver 0x0870), so a post-boot attract clone has its target VRAM column
 * pre-cleared and the hold flag 0x8004 zeroed, then both sides run. The routine sets all its own
 * registers, so any coherent post-boot state is a valid entry. The dissolved caller calls the idiomatic
 * tile-column blit directly while the oracle runs the frozen one, so their tile writes match; the
 * compared RAM is memory-only and excludes the dead [SP-8, SP) stack scratch the direct call leaves
 * unpushed. Teeth: four broken twins, each caught at a real cell. NOTE: links once names.js exports
 * loc_aa51, loc_2f6e, loc_2f12 (added in a later pass).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_085b } from "../loc_085b.js";
import { loc_085b as oracle } from "../../translated/loc_085b.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const HOLD = 0x8004;
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

// pre-clear the blitted VRAM column so the tile writes are observable; clear the hold flag.
function entry() {
  const e = seedMachine().clone();
  for (let a = 0xa400; a < 0xac00; a++) e.mem8[a] = 0;
  e.mem8[HOLD] = 0;
  return e;
}

// null == RAM-equivalent, excluding the dead [SP-8, SP) stack scratch. The dissolved caller makes a
// direct JS call instead of pushing a Z80 return bracket, so that window below the entry stack pointer
// carries oracle-only residue and never live-out. Memory-only: compare RAM, not registers or SP.
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

// broken twins.
function brokenNoOp() {}
function brokenWrongFlag(m) {
  const { regs, mem8 } = m;
  regs.hl = 0xaa51; regs.de = 0x2f6e; regs.b = 4; m.push16(0x0864); m.call(0x0028);
  regs.de = 0x2f12; regs.b = 5; m.push16(0x086a); m.call(0x0028);
  mem8[HOLD] = 2; // BUG: hold flag should be 1
}
function brokenSkipSecond(m) {
  const { regs, mem8 } = m;
  regs.hl = 0xaa51; regs.de = 0x2f6e; regs.b = 4; m.push16(0x0864); m.call(0x0028);
  // BUG: never blits the second (5-tile) strip
  mem8[HOLD] = 1;
}
function brokenWrongCount(m) {
  const { regs, mem8 } = m;
  regs.hl = 0xaa51; regs.de = 0x2f6e; regs.b = 5; m.push16(0x0864); m.call(0x0028); // BUG: 5 not 4
  regs.de = 0x2f12; regs.b = 5; m.push16(0x086a); m.call(0x0028);
  mem8[HOLD] = 1;
}

test("EQUAL (crafted): loc_085b == oracle", { skip }, () => {
  const e = entry();
  assert.equal(ramDiff(loc_085b, e), null, "the crafted entry diverged");
  // non-vacuous: the no-op twin diverging proves the oracle actually writes.
  assert.ok(ramDiff(brokenNoOp, entry()), "vacuous: oracle wrote nothing");
  console.log("  EQUAL: crafted no-more-frogs tail, loc_085b == oracle");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = entry();
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongFlag, e), "the wrong-flag twin escaped");
  assert.ok(ramDiff(brokenSkipSecond, e), "the skip-second twin escaped");
  assert.ok(ramDiff(brokenWrongCount, e), "the wrong-count twin escaped");
  console.log("  TEETH: no-op, wrong-flag, skip-second, wrong-count all caught");
});
