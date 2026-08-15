// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearSoundQueue — memory-equivalent to the frozen oracle at ROM 0x07D9.
 * GATE: crafted-entry. Attract never runs the new-game setup that dispatches this, and the queue
 * region reads all-zero there, so a post-boot machine is cloned and the region plus guard bytes are
 * poked non-zero; both sides must zero exactly 0x8300-0x832f and leave the guards intact. LIVE-OUT is
 * RAM only. The dead [SP-8,SP) window is masked. Teeth: no-op, off-by-one short/long, wrong base.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { clearSoundQueue } from "../clearSoundQueue.js";
import { loc_07d9 as oracle } from "../../translated/loc_07d9.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const QUEUE_BASE = 0x8300;
const QUEUE_LEN = 48;
const GUARD_LO = QUEUE_BASE - 8;
const GUARD_HI = QUEUE_BASE + QUEUE_LEN + 8;
const FILL = 0xab;
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

// A post-boot machine with the queue region AND its guard bytes poked non-zero.
function dirtyEntry() {
  const e = seedMachine().clone();
  for (let a = GUARD_LO; a < GUARD_HI; a++) e.mem8[a & 0xffff] = FILL;
  return e;
}

// null == equivalent. RAM-only live-out; mask the dead [SP-8,SP) window (far above the cleared region).
function ramDiff(cand, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  for (let k = 1; k <= 8; k++) { const w = (sp - k) & 0xffff; a.mem8[w] = 0; b.mem8[w] = 0; }
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `RAM 0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

function brokenNoOp() {}
function brokenShort(m) { for (let i = 0; i < QUEUE_LEN - 1; i++) m.mem8[(QUEUE_BASE + i) & 0xffff] = 0; }
function brokenLong(m) { for (let i = 0; i < QUEUE_LEN + 1; i++) m.mem8[(QUEUE_BASE + i) & 0xffff] = 0; }
function brokenWrongBase(m) { for (let i = 0; i < QUEUE_LEN; i++) m.mem8[(QUEUE_BASE + 1 + i) & 0xffff] = 0; }

test("EQUAL (crafted): clearSoundQueue == oracle on a dirty queue region", { skip }, () => {
  assert.equal(ramDiff(clearSoundQueue, dirtyEntry()), null, "clearSoundQueue diverged from the oracle");
  assert.ok(ramDiff(brokenNoOp, dirtyEntry()), "vacuous: oracle changed nothing on a dirty region");
  console.log("  EQUAL: clearSoundQueue == oracle (RAM), region 0x8300-0x832f zeroed, guards intact");
});

test("TEETH: broken twins are caught", { skip }, () => {
  assert.ok(ramDiff(brokenNoOp, dirtyEntry()), "the no-op twin escaped");
  assert.ok(ramDiff(brokenShort, dirtyEntry()), "the short (off-by-one) twin escaped");
  assert.ok(ramDiff(brokenLong, dirtyEntry()), "the long (over-clear) twin escaped");
  assert.ok(ramDiff(brokenWrongBase, dirtyEntry()), "the wrong-base twin escaped");
  console.log("  TEETH: no-op, short, long, wrong-base all caught");
});
