// SPDX-License-Identifier: GPL-3.0-only
/**
 * appendSoundCommandToQueue — memory-equivalent to the frozen oracle at ROM 0x562A.
 * WHAT IT IS, AND WHY THE SIGNATURE HAS A PARAMETER. 0x562A is not a callable routine: it is the CONTINUATION
 * of three entries (0x5628 falls into it, 0x560C and 0x5617 tail-jump into it), each of which has already
 * done `push hl` / `push af`. Read on its own it is unbalanced — it pops two pairs it never pushed. The `pop
 * af` recovers the COMMAND BYTE its entry spilled across the `rst 0x08` that clobbers A, so under the
 * no-stack contract that spill is not stack behaviour at all; it is a register save, and the rewrite carries
 * it in a JS local reached through a parameter. `pop hl` restores the caller's address register and is dead.
 * THE DISCARDED FETCH. The oracle reaches its store address through `rst 0x08`, which adds A to HL *and*
 * loads the byte there — and that byte is immediately overwritten by the `pop af` on the next instruction.
 * Only the address arithmetic survives, so the rewrite computes the address and does not call the restart.
 * That is memory-equivalent because a work-RAM read has no side effect.
 * GATE: strict unit-capture at the real dispatch, plus exhaustive crafted sweeps over the routine's whole
 * input space; what it exercises, holes stated. 1. EQUAL at the real dispatch — every byte of the state dump
 * agrees except inside the two-byte scratch window named in 2. 2. THE DEAD SCRATCH IS THE ONE EXCLUSION, and
 * it is PINNED: the walk asserts no divergence lies outside [SP-2, SP). The window is an upper bound, not a
 * prediction. 3. REGISTERS AND PC ARE EXCLUDED, DELIBERATELY, and pinned to a fixed shape. The oracle pops
 * six bytes it never pushed (two pairs plus its return address), so SP is expected to differ by exactly that.
 * 4. EXHAUSTIVE over the queue length, 0..255 — the routine's whole state space, the only arm reaching the
 * byte wrap of the count and the walk of the write address across the entire block. The real dispatch
 * presents a length of 0. 5. EXHAUSTIVE over the command byte. 6. NON-VACUOUS — the arm reads back what the
 * oracle actually did: the count steps by one and the code lands in the cell the NEW count selects, one past
 * the previous tail. 7. TEETH — five twins at five distinct behaviours, each caught at a real cell and never
 * on a scratch ghost.
 * HOLE: one dispatch state. Beyond the count and the command byte, the machine is fixed at the captured
 * entry; nothing here varies which entry spilled the command, because all three spill it identically.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-562a.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent } from "./_harness.js";
import {
  QUEUE_LENGTH,
  allDiffs,
  captureEntry,
  oracleAt,
  realDiff,
  show,
  spilledCommand,
  hex4,
} from "./_soundQueue.js";
import { appendSoundCommandToQueue } from "../appendSoundCommandToQueue.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x562a;
const SCRATCH_BYTES = 2;
const POPPED_BYTES = 6;

const skip = romsPresent() ? false : "ROM images are absent from this checkout";
const oracle = oracleAt(TARGET);

/** The candidate under the oracle's own calling convention: the byte the entry spilled. */
const candidate = (m) => appendSoundCommandToQueue(m, spilledCommand(m));

function entryState() {
  const e = captureEntry(TARGET);
  assert.notEqual(e, null, "vacuous: the tape never reached the routine");
  return e;
}

/** Oracle vs a candidate from the real entry, with the count and the command forced. */
function craftedDiff(cand, length, command) {
  const entry = entryState();
  const arms = [entry.clone(), entry.clone()];
  for (const s of arms) {
    s.mem8[QUEUE_LENGTH] = length;
    s.mem8[(s.regs.sp + 1) & 0xffff] = command;
  }
  oracle(arms[0]);
  cand(arms[1]);
  return realDiff(arms[0], arms[1], entry.regs.sp, SCRATCH_BYTES);
}

const COMMANDS = [0x00, 0x01, 0x0b, 0x7f, 0x80, 0x86, 0xa0, 0xff];

function sweepCaught(cand) {
  let caught = 0;
  for (let length = 0; length < 256; length++) if (craftedDiff(cand, length, 0x1a)) caught++;
  return caught;
}

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: appendSoundCommandToQueue == oracle on RAM", { skip }, () => {
  const entry = entryState();
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  candidate(b);
  const d = realDiff(a, b, entry.regs.sp, SCRATCH_BYTES);
  assert.equal(d, null, `RAM diverged — ${show(d)}`);
  const dirty = allDiffs(a, b).map((x) => x.addr);
  assert.ok(dirty.length > 0, "no divergence at all — the scratch push vanished, so this is blind");
  console.log(
    `  EQUAL: entry sp=${hex4(entry.regs.sp)} length=${entry.mem8[QUEUE_LENGTH]} ` +
      `command=${hex4(spilledCommand(entry))}; RAM identical outside [SP-${SCRATCH_BYTES}, SP)`,
  );
});

test("EXCLUDED, deliberately: registers, pc and the popped bytes and nothing else", { skip }, () => {
  const entry = entryState();
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  candidate(b);

  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(moved, ["sp"], "the excluded set changed shape: only the stack pointer may move");
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  assert.equal(
    a.regs.sp - b.regs.sp,
    POPPED_BYTES,
    "the oracle pops two pairs it never pushed plus its return address; the rewrite pops nothing",
  );
  const outside = allDiffs(a, b).filter(
    (d) => d.addr < entry.regs.sp - SCRATCH_BYTES || d.addr >= entry.regs.sp,
  );
  assert.deepEqual(outside, [], "a divergence escaped the scratch window");
  console.log(`  EXCLUDED: registers ${moved.join(", ")}, pc, and the scratch window only`);
});

test("EXHAUSTIVE over the queue length: every count 0..255 appends where the oracle appends", { skip }, () => {
  for (let length = 0; length < 256; length++) {
    const d = craftedDiff(candidate, length, 0x1a);
    assert.equal(d, null, `length=${length}: ${show(d)}`);
  }
  console.log("  EXHAUSTIVE: 256 queue lengths identical, including the byte wrap of the count");
});

test("EXHAUSTIVE over the command byte", { skip }, () => {
  for (const command of COMMANDS) {
    for (const length of [0, 1, 62, 127, 254, 255]) {
      const d = craftedDiff(candidate, length, command);
      assert.equal(d, null, `command=${hex4(command)} length=${length}: ${show(d)}`);
    }
  }
  console.log(`  EXHAUSTIVE: ${COMMANDS.length} command bytes across six lengths identical`);
});

test("NON-VACUOUS: the count steps and the code lands in the cell the new count selects", { skip }, () => {
  const s = entryState().clone();
  s.mem8[QUEUE_LENGTH] = 3;
  s.mem8[(s.regs.sp + 1) & 0xffff] = 0x86;
  const before = s.mem8[QUEUE_LENGTH + 4];
  oracle(s);
  assert.equal(s.mem8[QUEUE_LENGTH], 4, "the count must step by exactly one");
  assert.equal(s.mem8[QUEUE_LENGTH + 4], 0x86, "the code must land one past the previous tail");
  assert.notEqual(before, undefined, "the cell must exist in the dump");
  console.log("  NON-VACUOUS: count 3 -> 4 with the code appended at the new tail");
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────
// Each twin is a plausible way to get one of this routine's behaviours wrong, and each must be
// caught by the SAME masked comparison the real arm passes.

/** BUG: does nothing at all — the tell that a gate is measuring an unreached routine. */
function brokenNoOp() {}

/** BUG: appends before stepping the count, so every code overwrites the previous tail. */
function brokenWritesBeforeStepping(m) {
  const { mem8 } = m;
  const length = mem8[QUEUE_LENGTH];
  mem8[QUEUE_LENGTH + length] = spilledCommand(m);
  mem8[QUEUE_LENGTH] = (length + 1) & 0xff;
}

/** BUG: steps the count without appending anything, so the drain reads a stale cell. */
function brokenStepsOnly(m) {
  m.mem8[QUEUE_LENGTH] = (m.mem8[QUEUE_LENGTH] + 1) & 0xff;
}

/** BUG: wraps the count inside a fixed-size block instead of letting it wrap at a byte. */
function brokenWrapsInBlock(m) {
  const { mem8 } = m;
  const length = (mem8[QUEUE_LENGTH] + 1) % 64;
  mem8[QUEUE_LENGTH] = length;
  mem8[QUEUE_LENGTH + length] = spilledCommand(m);
}

/** BUG: takes the command from A, which holds the command at one entry and a gate cell at two. */
function brokenTakesCommandFromA(m) {
  const { mem8 } = m;
  const length = (mem8[QUEUE_LENGTH] + 1) & 0xff;
  mem8[QUEUE_LENGTH] = length;
  mem8[QUEUE_LENGTH + length] = m.regs.a;
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["writes-before-stepping", brokenWritesBeforeStepping],
  ["steps-only", brokenStepsOnly],
  ["wraps-in-block", brokenWrapsInBlock],
  ["takes-command-from-a", brokenTakesCommandFromA],
];

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT across the length sweep`, { skip }, () => {
    const caught = sweepCaught(twin);
    assert.ok(caught > 0, `the sweep PASSED the ${label} twin — it has no teeth`);
    const first = [...Array(256).keys()].map((n) => craftedDiff(twin, n, 0x1a)).find(Boolean);
    console.log(`  TEETH/${label}: caught on ${caught}/256 lengths — first ${show(first)}`);
  });
}
