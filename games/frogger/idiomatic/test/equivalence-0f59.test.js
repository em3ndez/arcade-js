// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0f59 — memory-equivalent to the frozen oracle at ROM 0x0F59.
 * GATE: crafted-entry. Attract never dispatches this status-line redraw (probe: 0 dispatches over
 * ENTRY_FRAMES), so a post-boot attract machine is cloned and the two VRAM regions the routine
 * touches are pre-filled with markers so the clear (0x19E2) and the 9-tile stamp (0x0028) are
 * observable. The dissolved caller calls the idiomatic clear and stamp directly while the oracle runs
 * the frozen ones, so their writes match. The routine has no register live-in and a memory-only
 * live-out, so registers/SP are not compared, and the compared RAM excludes the dead [SP-8, SP) stack
 * scratch the direct calls leave unpushed. Teeth: no-op, skip-stamp, wrong-count.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_0f59 } from "../loc_0f59.js";
import { loc_0f59 as oracle } from "../../translated/loc_0f59.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const CLEAR_BASE = 0xa850;
const STAMP_BASE = 0xaa70;
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

// A post-boot machine with both touched VRAM regions pre-filled so the clear + stamp are observable.
function entry(mark) {
  const e = seedMachine().clone();
  for (let i = 0; i < 14 * 64; i++) e.mem8[(CLEAR_BASE + i) & 0xffff] = mark;
  for (let i = 0; i < 9 * 32; i++) e.mem8[(STAMP_BASE - i * 32) & 0xffff] = mark ^ 0xff;
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

const MARKS = [0x11, 0x55, 0xaa, 0xf0];

function brokenNoOp() {}
function brokenSkipStamp(m) {
  const { regs } = m;
  regs.hl = CLEAR_BASE; m.push16(0x0f5f); m.call(0x19e2); // clear only, no stamp
}
function brokenWrongCount(m) {
  const { regs } = m;
  regs.hl = CLEAR_BASE; m.push16(0x0f5f); m.call(0x19e2);
  regs.hl = STAMP_BASE; regs.de = 0x2f0e; regs.b = 8; m.push16(0x0f68); m.call(0x0028); // BUG: 8 not 9
}

test("EQUAL (crafted): loc_0f59 == oracle on every marker fill", { skip }, () => {
  const entries = MARKS.map(entry);
  for (const e of entries) assert.equal(ramDiff(loc_0f59, e), null, "a crafted entry diverged");
  assert.ok(ramDiff(brokenNoOp, entry(0x55)), "vacuous: oracle wrote nothing");
  console.log(`  EQUAL: ${entries.length} marker fills, loc_0f59 == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = entry(0x55);
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenSkipStamp, e), "the skip-stamp twin escaped");
  assert.ok(ramDiff(brokenWrongCount, e), "the wrong-count twin escaped");
  console.log("  TEETH: no-op, skip-stamp, wrong-count all caught");
});
