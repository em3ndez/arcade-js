// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillAllHomeSlotsAndAwardLife — memory-equivalent to the frozen oracle at ROM 0x0670.
 * GATE: crafted-entry. Attract never dispatches this all-home-slots stamp (probe: 0 dispatches over
 * ENTRY_FRAMES; it is reached only on board completion, which attract does not play), so a post-boot
 * attract machine is cloned. The routine takes no live-in — it stamps the five fixed slot bases
 * unconditionally — but attract leaves those blocks pre-stamped, so the entry clears them to make each
 * stamp observable and pokes a below-cap life count for player one so the award stamps its marker. Each side runs the
 * real still-frozen stamp routine and the award tail on its own clone, so their writes are part of
 * the compared live-out. Memory-only live-out (RAM compared, not registers/SP); the dissolved calls
 * mask the oracle's dead [SP-8,SP) stack scratch. Teeth: no-op, skip-a-call (drops slot 5), skip-tail.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { fillAllHomeSlotsAndAwardLife } from "../fillAllHomeSlotsAndAwardLife.js";
import { loc_0670 as oracle } from "../../translated/loc_0670.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ACTIVE_PLAYER = 0x83fd;
const LIFE_COUNT_P1 = 0x83b8;
const STAMP_SLOT = 0x0695;
const AWARD_TAIL = 0x0a5f;
const SLOT_BASES = [0xab64, 0xaaa4, 0xa9e4, 0xa924, 0xa864];
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

// A post-boot machine with a below-cap life count so the tail award stamps a marker. Attract leaves the
// five slot blocks pre-stamped, so clear them here to make each stamp an observable VRAM write.
function craft() {
  const e = seedMachine().clone();
  e.mem8[ACTIVE_PLAYER] = 1;
  e.mem8[LIFE_COUNT_P1] = 3;
  for (const b of SLOT_BASES) for (const off of [0, 1, 32, 33]) e.mem8[(b + off) & 0xffff] = 0;
  return e;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP. Neutralize the
// dead [SP-8,SP) stack scratch the oracle's per-slot push/call leaves and the register-free rewrite does not.
function ramDiff(cand, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  for (let k = 1; k <= 8; k++) { const w = (sp - k) & 0xffff; a.mem8[w] = 0; b.mem8[w] = 0; }
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// broken twins.
function brokenNoOp() {}
function brokenSkipSlot5(m) { // stamps only four slots
  const { regs, mem8 } = m;
  regs.hl = 0xab64; m.push16(0x0676); m.call(STAMP_SLOT);
  regs.hl = 0xaaa4; m.push16(0x067c); m.call(STAMP_SLOT);
  regs.hl = 0xa9e4; m.push16(0x0682); m.call(STAMP_SLOT);
  regs.hl = 0xa924; m.push16(0x0688); m.call(STAMP_SLOT);
  // BUG: omit slot 5 (0xa864)
  mem8[0x842f] = 0;
  return m.call(AWARD_TAIL);
}
function brokenSkipTail(m) { // stamps all five but drops the award hand-off
  const { regs, mem8 } = m;
  regs.hl = 0xab64; m.push16(0x0676); m.call(STAMP_SLOT);
  regs.hl = 0xaaa4; m.push16(0x067c); m.call(STAMP_SLOT);
  regs.hl = 0xa9e4; m.push16(0x0682); m.call(STAMP_SLOT);
  regs.hl = 0xa924; m.push16(0x0688); m.call(STAMP_SLOT);
  regs.hl = 0xa864; m.push16(0x068e); m.call(STAMP_SLOT);
  mem8[0x842f] = 0;
  // BUG: omit the award tail
}

test("EQUAL (crafted): fillAllHomeSlotsAndAwardLife == oracle on the stamp-all-plus-award entry", { skip }, () => {
  const e = craft();
  assert.equal(ramDiff(fillAllHomeSlotsAndAwardLife, e), null, "the crafted entry diverged");
  assert.ok(ramDiff(brokenNoOp, e), "vacuous: oracle wrote nothing");
  console.log("  EQUAL: stamp-all + award, fillAllHomeSlotsAndAwardLife == oracle");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = craft();
  assert.ok(ramDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ramDiff(brokenSkipSlot5, e), "the skip-slot5 twin escaped");
  assert.ok(ramDiff(brokenSkipTail, e), "the skip-tail twin escaped");
  console.log("  TEETH: no-op, skip-slot5, skip-tail all caught");
});
