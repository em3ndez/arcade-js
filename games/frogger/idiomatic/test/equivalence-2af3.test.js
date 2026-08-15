// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2af3 — memory-equivalent to the frozen oracle at ROM 0x2AF3.
 * GATE: crafted-entry (probe: 0 within ENTRY_FRAMES). A post-boot clone has IX/IY set to a real object
 * record (0x8440) and sprite slot (0x8048) — the pair the ROM's dispatcher uses — then the record
 * fields poked to drive every path: inactive skip, both X sources, both bias arms, the wrap-clear. The
 * shared arm helper (0x2AE6) runs on each side's clone so its writes are compared. Memory-only live-out;
 * the oracle's wrap path leaves 2 dead scratch bytes at [SP-2] (the register-free rewrite doesn't), so
 * the [SP-8, SP) window is masked. Teeth: four twins, incl. a skip-helper and a no-clear on the wrap.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_2af3 } from "../loc_2af3.js";
import { loc_2af3 as oracle } from "../../translated/loc_2af3.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const RECORD = 0x8440; // an IX object-record base the dispatcher uses
const SLOT = 0x8048;   // the paired IY sprite slot
const FROG_X = 0x8014;
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

// A post-boot machine with IX/IY set and the record fields (offsets from RECORD) poked.
function craft(fields, frogX) {
  const e = seedMachine().clone();
  e.regs.ix = RECORD;
  e.regs.iy = SLOT;
  for (const [off, v] of Object.entries(fields)) e.mem8[(RECORD + Number(off)) & 0xffff] = v;
  if (frogX !== undefined) e.mem8[FROG_X] = frogX;
  return e;
}

// null == RAM-equivalent over everything but the dead [SP-8, SP) stack scratch.
function ramDiffMaskStack(cand, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const da = a.dumpState(), db = b.dumpState();
  for (let addr = sp - 8; addr < sp; addr++) {
    const off = (addr & 0xffff) - 0x8000;
    if (off >= 0 && off < 0x800) { da[off] = 0; db[off] = 0; }
  }
  const d = firstStateDiff(da, db, (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// path entries.
const inactive = () => craft({ 6: 0 });
const pathA = () => craft({ 6: 1, 4: 0x30, 2: 0x10, 5: 0, 7: 0 }, 0x80); // X from frog-relative, low-bias arm
const pathB = () => craft({ 6: 1, 4: 0x60, 3: 0x55, 5: 0, 7: 0 });       // X from the record byte
const highArm = () => craft({ 6: 1, 4: 0x30, 2: 0x10, 5: 1, 7: 0 }, 0x80); // high-bias arm
const foldNoRetire = () => craft({ 6: 1, 4: 0x60, 3: 0, 5: 1, 7: 0 });    // reaches the fold, retire flag clear
const wrap = () => craft({ 6: 1, 4: 0x60, 3: 0, 5: 1, 7: 1 });            // fold + retire -> clear record and slot

// broken twins (exercised on the wrap entry unless noted).
function brokenNoOp() {}
function brokenWrongMirror(m) { oracle(m); m.mem8[(SLOT + 3) & 0xffff] ^= 1; } // BUG: corrupt the mirrored attr byte
function brokenSkipHelper(m) {
  const { regs, mem8 } = m;
  if (mem8[(regs.ix + 6) & 0xffff] === 0) return;
  const record = regs.ix, slot = regs.iy; // BUG: never calls the arm helper (0x8371 latch missing)
  const attr = mem8[(record + 4) & 0xffff];
  let x; if (attr >= 0x60) x = mem8[(record + 3) & 0xffff]; else x = (mem8[FROG_X] - mem8[(record + 2) & 0xffff]) & 0xff;
  mem8[slot & 0xffff] = x; mem8[(slot + 3) & 0xffff] = attr; mem8[(slot + 7) & 0xffff] = attr;
  mem8[(slot + 4) & 0xffff] = mem8[(record + 5) & 0xffff] !== 0 ? (0xf1 + x) & 0xff : (0x0f + x) & 0xff;
}
function brokenNoClear(m) {
  const { regs, mem8 } = m;
  if (mem8[(regs.ix + 6) & 0xffff] === 0) return;
  m.push16(0x2afb); m.call(0x2ae6);
  const record = regs.ix, slot = regs.iy;
  const attr = mem8[(record + 4) & 0xffff];
  const x = mem8[(record + 3) & 0xffff];
  mem8[slot & 0xffff] = x; mem8[(slot + 3) & 0xffff] = attr; mem8[(slot + 7) & 0xffff] = attr;
  mem8[(slot + 4) & 0xffff] = (0xf1 + x) & 0xff; // BUG: reaches the wrap but never clears record/slot
}

test("EQUAL (crafted): loc_2af3 == oracle on every arm", { skip }, () => {
  for (const [name, mk] of [
    ["inactive", inactive], ["pathA", pathA], ["pathB", pathB],
    ["highArm", highArm], ["foldNoRetire", foldNoRetire], ["wrap", wrap],
  ]) {
    assert.equal(ramDiffMaskStack(loc_2af3, mk()), null, `the ${name} arm diverged`);
  }
  // non-vacuous: the wrap arm actually rewrites RAM.
  assert.ok(ramDiffMaskStack(brokenNoOp, wrap()), "vacuous: oracle wrote nothing on the wrap arm");
  console.log("  EQUAL: inactive/pathA/pathB/highArm/foldNoRetire/wrap, loc_2af3 == oracle");
});

test("TEETH: broken twins are caught", { skip }, () => {
  assert.ok(ramDiffMaskStack(brokenNoOp, pathA()), "the no-op twin escaped");
  assert.ok(ramDiffMaskStack(brokenWrongMirror, pathA()), "the wrong-mirror twin escaped");
  assert.ok(ramDiffMaskStack(brokenSkipHelper, pathA()), "the skip-helper twin escaped");
  assert.ok(ramDiffMaskStack(brokenNoClear, wrap()), "the no-clear twin escaped");
  console.log("  TEETH: no-op, wrong-mirror, skip-helper, no-clear all caught");
});
