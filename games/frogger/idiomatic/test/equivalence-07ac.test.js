// SPDX-License-Identifier: GPL-3.0-only
/**
 * dequeueSoundCommand — memory-equivalent to the frozen oracle at ROM 0x07AC.
 * GATE: crafted-entry. Attract never dispatches this sound-queue consumer within ENTRY_FRAMES (probe:
 * 0 — it runs only from the in-game NMI branch), so a post-boot attract machine is cloned and its
 * queue seeded: the count cell (0x8300) and the command slots above it. Both sides run the real sound
 * issuer (0x0794) on their own clone, so its effect is part of the compared live-out.
 *
 * LIVE-OUT IS IO + RAM. The issuer writes the two sound PPI ports (0xD000 command latch, 0xD002
 * control whose bit-3 falling edge asserts the audio interrupt), which dumpState() cannot see — so
 * this gate compares io.soundData/soundControl/soundTriggers explicitly AND the RAM (the decremented
 * count and the shifted queue). Registers/SP not compared; the dissolved call masks the oracle's dead
 * [SP-8,SP) stack scratch. Teeth: no-op, no-decrement, shift-without-issue.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { dequeueSoundCommand } from "../dequeueSoundCommand.js";
import { loc_07ac as oracle } from "../../translated/loc_07ac.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const QUEUE_COUNT = 0x8300;
const ISSUE_SOUND = 0x0794;
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

// A post-boot machine with a seeded sound queue: `cmds` is the command bytes above the count cell.
function entryWithQueue(cmds) {
  const e = seedMachine().clone();
  e.mem8[QUEUE_COUNT] = cmds.length;
  cmds.forEach((c, i) => { e.mem8[(QUEUE_COUNT + 1 + i) & 0xffff] = c; });
  return e;
}

// null == equivalent. Live-out is IO (sound latch/control/edge) AND RAM (count + shifted queue).
// Neutralize the dead [SP-8,SP) stack scratch the oracle's push/call/ret leaves and the rewrite does not.
function ioRamDiff(cand, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  if (a.io.soundData !== b.io.soundData) return `soundData 0x${a.io.soundData.toString(16)} vs 0x${b.io.soundData.toString(16)}`;
  if (a.io.soundControl !== b.io.soundControl) return `soundControl 0x${a.io.soundControl.toString(16)} vs 0x${b.io.soundControl.toString(16)}`;
  if (a.io.soundTriggers !== b.io.soundTriggers) return `soundTriggers ${a.io.soundTriggers} vs ${b.io.soundTriggers}`;
  for (let k = 1; k <= 8; k++) { const w = (sp - k) & 0xffff; a.mem8[w] = 0; b.mem8[w] = 0; }
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `RAM 0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// broken twins.
function brokenNoOp() {} // never drains: no decrement, no sound
function brokenNoDecrement(m) {
  const { regs, mem8 } = m;
  const p = mem8[QUEUE_COUNT];
  if (p === 0) return;
  regs.a = mem8[(QUEUE_COUNT + 1) & 0xffff];
  m.push16(0x07b9); m.call(ISSUE_SOUND);
  for (let i = 0; i < p; i++) mem8[(QUEUE_COUNT + 1 + i) & 0xffff] = mem8[(QUEUE_COUNT + 2 + i) & 0xffff]; // BUG: count not decremented
}
function brokenShiftNoIssue(m) {
  const { mem8 } = m;
  const p = mem8[QUEUE_COUNT];
  if (p === 0) return;
  mem8[QUEUE_COUNT] = p - 1;
  for (let i = 0; i < p; i++) mem8[(QUEUE_COUNT + 1 + i) & 0xffff] = mem8[(QUEUE_COUNT + 2 + i) & 0xffff]; // BUG: sound never issued
}

test("EQUAL (crafted): dequeueSoundCommand == oracle on every queue depth", { skip }, () => {
  const one = entryWithQueue([0x07, 0x11]);
  const many = entryWithQueue([0x07, 0x08, 0x09, 0x0a, 0x22]);
  const empty = entryWithQueue([]);
  assert.equal(ioRamDiff(dequeueSoundCommand, one), null, "single-command queue diverged");
  assert.equal(ioRamDiff(dequeueSoundCommand, many), null, "multi-command queue diverged");
  assert.equal(ioRamDiff(dequeueSoundCommand, empty), null, "empty-queue early return diverged");
  // non-vacuous: on a filled queue the oracle actually issues sound and shifts.
  assert.ok(ioRamDiff(brokenNoOp, many), "vacuous: oracle did nothing on a filled queue");
  console.log("  EQUAL: depth 1/many/0, dequeueSoundCommand == oracle (io + RAM)");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const many = entryWithQueue([0x07, 0x08, 0x09, 0x0a, 0x22]);
  assert.ok(ioRamDiff(brokenNoOp, many), "the no-op twin escaped");
  assert.ok(ioRamDiff(brokenNoDecrement, many), "the no-decrement twin escaped");
  assert.ok(ioRamDiff(brokenShiftNoIssue, many), "the shift-without-issue twin escaped");
  console.log("  TEETH: no-op, no-decrement, shift-without-issue all caught");
});
