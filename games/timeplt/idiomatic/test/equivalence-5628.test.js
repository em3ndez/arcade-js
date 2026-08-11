// SPDX-License-Identifier: GPL-3.0-only
/**
 * enqueueSoundUnconditional — memory-equivalent to the frozen oracle at ROM 0x5628.
 * WHAT IT IS. Two instructions, `push hl` / `push af`, and then it FALLS INTO the enqueue body at 0x562A.
 * Under the no-stack contract neither push is stack behaviour: the AF push is the spill that carries the
 * command byte across the body's register-clobbering restart, and the HL push is the save half of a
 * save/restore — the body clobbers HL and the `pop hl` at 0x5632 hands the caller its own HL back, so the
 * PAIR is a no-op in aggregate, which the stack-free rewrite reproduces by never writing HL at all. So the
 * rewrite is a forward, and the entire content of this entry is the ABSENCE of a permission test — it is
 * the only way into the queue that posts whether or not a game is being played. That is the property the
 * twin list attacks: twins gate it the way its siblings do, and each must be caught.
 * GATE: strict unit-capture at the real dispatch, plus crafted crosses over both permission cells
 *   and over the command byte. What it exercises, holes stated:
 *   1. EQUAL at the real dispatch — RAM identical outside the scratch window named in 2.
 *   2. THE DEAD SCRATCH IS THE ONE EXCLUSION and it is PINNED to [SP-6, SP): two pairs pushed
 *      here and by the body, plus the body's return address for its restart. Upper bound, not a
 *      prediction — where a pushed byte already held its own value nothing differs there.
 *   3. REGISTERS AND PC ARE EXCLUDED, DELIBERATELY, and pinned to a fixed shape.
 *   4. EXHAUSTIVE over both permission cells — every play-active value against both demo-sound
 *      values, each poked identically on both sides, and separately asserted to make no
 *      difference to what the ORACLE does. That second assertion is what makes "unconditional"
 *      a measured property of this entry rather than a reading of its two instructions.
 *   5. EXHAUSTIVE over the queue length, 0..255.
 *   6. THE COMMAND BYTE IS SWEPT, high bit included. The captured entry always arrives with the same
 *      command, so without this any transform that is the identity at that one value would escape the whole
 *      gate — and it would not be academic: the entry at 0x565D reaches here via `add a,0x8c`, so real
 *      callers post codes with the high bit set, exactly what a mask bug would corrupt.
 *   7. TEETH — twins that gate the way the sibling entries do, plus a fixed-command twin.
 *      The twin cross is SAMPLED over the permission cells, not exhaustive; catching a twin needs
 *      one discriminating combination, and the exhaustive arms above are where coverage is claimed.
 * HOLE: this gate never sees the queue drained. It measures one append against one append.
 * Run: node --test games/timeplt/idiomatic/test/equivalence-5628.test.js
 */

import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent } from "./_harness.js";
import {
  DEMO_SOUNDS,
  QUEUE_LENGTH,
  allDiffs,
  captureEntry,
  hex4,
  oracleAt,
  realDiff,
  show,
} from "./_soundQueue.js";
import { enqueueSoundUnconditional } from "../enqueueSoundUnconditional.js";
import { PLAY_ACTIVE } from "../names.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x5628;
const SCRATCH_BYTES = 6;

const skip = romsPresent() ? false : "ROM images are absent from this checkout";
const oracle = oracleAt(TARGET);

function entryState() {
  const e = captureEntry(TARGET);
  assert.notEqual(e, null, "vacuous: the tape never reached the routine");
  return e;
}

// Both arms from the real entry, with the two permission cells and the count forced. A non-null
// `command` also forces the accumulator, which is where this entry takes the code from.
function craftedDiff(cand, play, demo, length, command = null) {
  const entry = entryState();
  const arms = [entry.clone(), entry.clone()];
  for (const s of arms) {
    s.mem8[PLAY_ACTIVE] = play;
    s.mem8[DEMO_SOUNDS] = demo;
    s.mem8[QUEUE_LENGTH] = length;
    if (command !== null) s.regs.a = command;
  }
  oracle(arms[0]);
  cand(arms[1]);
  return realDiff(arms[0], arms[1], entry.regs.sp, SCRATCH_BYTES);
}

const DEMO_VALUES = [0x00, 0x01];

const SAMPLED_PLAY = [0x00, 0x01, 0x7f, 0xff];

const COMMANDS = [0x00, 0x01, 0x0b, 0x7f, 0x80, 0x86, 0xa0, 0xff];

function crossCaught(cand) {
  let caught = 0;
  for (const play of SAMPLED_PLAY) {
    for (const demo of DEMO_VALUES) {
      for (const length of [0, 3, 255]) if (craftedDiff(cand, play, demo, length)) caught++;
    }
  }
  return caught;
}

const CROSS_SIZE = SAMPLED_PLAY.length * DEMO_VALUES.length * 3;

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: enqueueSoundUnconditional == oracle on RAM", { skip }, () => {
  const entry = entryState();
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  enqueueSoundUnconditional(b);
  const d = realDiff(a, b, entry.regs.sp, SCRATCH_BYTES);
  assert.equal(d, null, `RAM diverged — ${show(d)}`);
  assert.ok(allDiffs(a, b).length > 0, "no divergence at all — the scratch push vanished");
  console.log(
    `  EQUAL: entry sp=${hex4(entry.regs.sp)} play=${entry.mem8[PLAY_ACTIVE]} ` +
      `command=${hex4(entry.regs.a)}; RAM identical outside [SP-${SCRATCH_BYTES}, SP)`,
  );
});

test("EXCLUDED, deliberately: registers, pc and the scratch window and nothing else", { skip }, () => {
  const entry = entryState();
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  enqueueSoundUnconditional(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(moved, ["sp"], "the excluded set changed shape: only the stack pointer may move");
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  assert.equal(a.regs.sp - b.regs.sp, 2, "the oracle pops its return address; the rewrite does not");
  assert.equal(a.regs.a, b.regs.a, "the command byte is an input and must survive on both sides");
  const outside = allDiffs(a, b).filter(
    (d) => d.addr < entry.regs.sp - SCRATCH_BYTES || d.addr >= entry.regs.sp,
  );
  assert.deepEqual(outside, [], "a divergence escaped the scratch window");
  console.log(`  EXCLUDED: registers ${moved.join(", ")}, pc, and the scratch window only`);
});

test("EXHAUSTIVE over both permission cells: the cross is identical", { skip }, () => {
  for (let play = 0; play < 256; play++) {
    for (const demo of DEMO_VALUES) {
      const d = craftedDiff(enqueueSoundUnconditional, play, demo, 3);
      assert.equal(d, null, `play=${play} demo=${demo}: ${show(d)}`);
    }
  }
  console.log("  EXHAUSTIVE: every play-active value against both demo settings, identical");
});

test("SWEPT over the command byte, high bit included", { skip }, () => {
  for (const command of COMMANDS) {
    for (const length of [0, 3, 255]) {
      const d = craftedDiff(enqueueSoundUnconditional, 0x00, 0x00, length, command);
      assert.equal(d, null, `command=${hex4(command)} length=${length}: ${show(d)}`);
    }
  }
  assert.ok(COMMANDS.some((c) => c & 0x80), "the sweep cannot catch a mask bug without a high code");
  console.log("  SWEPT: the command byte varies, and codes with bit 7 set are among them");
});

test("UNCONDITIONAL: the oracle appends on every permission-cell combination", { skip }, () => {
  for (const play of SAMPLED_PLAY) {
    for (const demo of DEMO_VALUES) {
      const s = entryState().clone();
      s.mem8[PLAY_ACTIVE] = play;
      s.mem8[DEMO_SOUNDS] = demo;
      s.mem8[QUEUE_LENGTH] = 2;
      oracle(s);
      assert.equal(s.mem8[QUEUE_LENGTH], 3, `play=${play} demo=${demo} did NOT append`);
    }
  }
  console.log("  UNCONDITIONAL: appended with both permission cells clear, so nothing gates it");
});

test("EXHAUSTIVE over the queue length", { skip }, () => {
  for (let length = 0; length < 256; length++) {
    const d = craftedDiff(enqueueSoundUnconditional, 0x00, 0x00, length);
    assert.equal(d, null, `length=${length}: ${show(d)}`);
  }
  console.log("  EXHAUSTIVE: 256 queue lengths identical");
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: gates on the play flag, which is the neighbouring entry's behaviour, not this one's. */
function brokenGatesOnPlay(m) {
  if (m.mem8[PLAY_ACTIVE] === 0) return;
  enqueueSoundUnconditional(m);
}

/** BUG: gates on the demo-sound switch. */
function brokenGatesOnDemo(m) {
  if (m.mem8[DEMO_SOUNDS] === 0) return;
  enqueueSoundUnconditional(m);
}

/** BUG: gates on either cell, which is the OTHER neighbouring entry's behaviour. */
function brokenGatesOnEither(m) {
  if (m.mem8[PLAY_ACTIVE] === 0 && m.mem8[DEMO_SOUNDS] === 0) return;
  enqueueSoundUnconditional(m);
}

/** BUG: appends a fixed code instead of the one the caller is holding. */
function brokenFixedCommand(m) {
  enqueueSoundUnconditional(m, 0x86);
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["gates-on-play", brokenGatesOnPlay],
  ["gates-on-demo", brokenGatesOnDemo],
  ["gates-on-either", brokenGatesOnEither],
  ["fixed-command", brokenFixedCommand],
];

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT in the crafted cross`, { skip }, () => {
    const caught = crossCaught(twin);
    assert.ok(caught > 0, `the cross PASSED the ${label} twin — it has no teeth`);
    const first = SAMPLED_PLAY.flatMap((p) =>
      DEMO_VALUES.map((dm) => craftedDiff(twin, p, dm, 0)),
    ).find(Boolean);
    console.log(`  TEETH/${label}: caught on ${caught}/${CROSS_SIZE} sampled — first ${show(first)}`);
  });
}
