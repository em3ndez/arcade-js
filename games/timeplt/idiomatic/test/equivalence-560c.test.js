// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_560c — memory-equivalent to the frozen oracle at ROM 0x560C.
 *
 * WHAT IT IS. It spills the command byte, tests ONE permission cell — the play-active flag — and
 * tail-jumps into the enqueue body at 0x562A when it is set. With it clear it pops back and
 * returns, so the request is dropped and nothing records that it happened. The rewrite calls the
 * body directly, which is this caller's own dissolve, and the spill becomes a parameter.
 *
 * ★ THE HOLE THIS GATE EXISTS TO FILL. The play flag is SET at every dispatch the shared tape
 *   produces — the sound requests that reach this entry come from a game in progress — so the
 *   DROP branch never once executes on real data. Identical-on-the-real-dispatch therefore says
 *   nothing about half of this routine, and the crafted cross below is not a supplement to the
 *   real arm; it is the only thing testing the branch. A test asserts that blindness explicitly,
 *   so "the corpus agrees" can never be read here as reassurance.
 *
 * ★ WHAT SEPARATES IT FROM ITS SIBLING at 0x5617, which is otherwise the same shape: this entry
 *   consults ONE cell and is BLIND to the demo-sound switch. The cross varies both cells
 *   independently and asserts the oracle ignores the second, which is a prediction that could
 *   have come out the other way — and a twin that consults it is caught.
 *
 * GATE: strict unit-capture at the real dispatch, plus an exhaustive crafted cross over both
 *   permission cells and the queue length. What it exercises, holes stated:
 *
 *   1. EQUAL at the real dispatch — RAM identical outside the scratch window named in 2.
 *   2. THE DEAD SCRATCH IS THE ONE EXCLUSION, PINNED to [SP-6, SP). An upper bound, not a
 *      prediction: on the drop path only two pairs are pushed and popped, and where a pushed byte
 *      already held its own value nothing differs there at all.
 *   3. REGISTERS AND PC ARE EXCLUDED, DELIBERATELY, and pinned to a fixed shape.
 *   4. EXHAUSTIVE over the play flag, 0..255 — the routine's whole gate space, which is where the
 *      drop branch lives.
 *   5. THE SECOND CELL IS IGNORED — the cross varies the demo-sound switch against every play
 *      value and asserts the oracle's behaviour does not move with it.
 *   6. BOTH BRANCHES REALLY DIFFER — read back from the oracle: set posts, clear leaves the queue
 *      and its count byte-identical.
 *   7. EXHAUSTIVE over the queue length, 0..255.
 *   8. TEETH — five twins, and the arm that pins WHICH of them the real dispatch alone is blind
 *      to. Three of the five are invisible at it, all three for the same reason: with the play
 *      flag set, every twin that only DIFFERS when it is clear behaves exactly as the routine
 *      does. That list is asserted rather than described, so it cannot drift.
 *
 * Run: node --test games/timeplt/idiomatic/test/equivalence-560c.test.js
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
import { loc_560c } from "../loc_560c.js";
import { loc_562a } from "../loc_562a.js";
import { PLAY_ACTIVE } from "../names.js";
import { REG_FIELDS } from "../../../../core/cpu/z80.js";

const TARGET = 0x560c;
const SCRATCH_BYTES = 6;

const skip = romsPresent() ? false : "ROM images are absent from this checkout";
const oracle = oracleAt(TARGET);

function entryState() {
  const e = captureEntry(TARGET);
  assert.notEqual(e, null, "vacuous: the tape never reached the routine");
  return e;
}

function craftedDiff(cand, play, demo, length) {
  const entry = entryState();
  const arms = [entry.clone(), entry.clone()];
  for (const s of arms) {
    s.mem8[PLAY_ACTIVE] = play;
    s.mem8[DEMO_SOUNDS] = demo;
    s.mem8[QUEUE_LENGTH] = length;
  }
  oracle(arms[0]);
  cand(arms[1]);
  return realDiff(arms[0], arms[1], entry.regs.sp, SCRATCH_BYTES);
}

/** Oracle vs candidate at the ONE state the shared tape actually produces. */
function realDispatchDiff(cand) {
  const entry = entryState();
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  cand(b);
  return realDiff(a, b, entry.regs.sp, SCRATCH_BYTES);
}

const DEMO_VALUES = [0x00, 0x01];

function crossCaught(cand) {
  let caught = 0;
  for (let play = 0; play < 256; play++) {
    for (const demo of DEMO_VALUES) if (craftedDiff(cand, play, demo, 3)) caught++;
  }
  return caught;
}

const CROSS_SIZE = 256 * DEMO_VALUES.length;

// ── the gate ────────────────────────────────────────────────────────────────────────────

test("EQUAL at the real dispatch: loc_560c == oracle on RAM", { skip }, () => {
  const entry = entryState();
  assert.notEqual(entry.mem8[PLAY_ACTIVE], 0, "the real dispatch takes the POSTING branch");
  assert.equal(realDispatchDiff(loc_560c), null, "RAM diverged at the real dispatch");
  const a = entry.clone();
  const b = entry.clone();
  oracle(a);
  loc_560c(b);
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
  loc_560c(b);
  const moved = REG_FIELDS.filter((k) => a.regs[k] !== b.regs[k]);
  assert.deepEqual(moved, ["sp"], "the excluded set changed shape: only the stack pointer may move");
  assert.notEqual(a.pc, b.pc, "the oracle's return moves pc; the rewrite returns to JS");
  assert.equal(a.regs.sp - b.regs.sp, 2, "the oracle pops its return address; the rewrite does not");
  const outside = allDiffs(a, b).filter(
    (d) => d.addr < entry.regs.sp - SCRATCH_BYTES || d.addr >= entry.regs.sp,
  );
  assert.deepEqual(outside, [], "a divergence escaped the scratch window");
  console.log(`  EXCLUDED: registers ${moved.join(", ")}, pc, and the scratch window only`);
});

test("EXHAUSTIVE over the play flag: all 256 values, both demo settings", { skip }, () => {
  for (let play = 0; play < 256; play++) {
    for (const demo of DEMO_VALUES) {
      const d = craftedDiff(loc_560c, play, demo, 3);
      assert.equal(d, null, `play=${play} demo=${demo}: ${show(d)}`);
    }
  }
  console.log(`  EXHAUSTIVE: ${CROSS_SIZE} gate combinations identical`);
});

test("THE SECOND CELL IS IGNORED: the demo-sound switch does not move the oracle", { skip }, () => {
  for (const play of [0x00, 0x01, 0xff]) {
    const posted = DEMO_VALUES.map((demo) => {
      const s = entryState().clone();
      s.mem8[PLAY_ACTIVE] = play;
      s.mem8[DEMO_SOUNDS] = demo;
      s.mem8[QUEUE_LENGTH] = 2;
      oracle(s);
      return s.mem8[QUEUE_LENGTH];
    });
    assert.equal(posted[0], posted[1], `play=${play}: the demo switch changed what the oracle did`);
  }
  console.log("  IGNORED: the demo-sound switch changes nothing here, which is what separates it");
});

test("BOTH BRANCHES REALLY DIFFER: set posts, clear leaves the queue untouched", { skip }, () => {
  const on = entryState().clone();
  on.mem8[PLAY_ACTIVE] = 0xff;
  on.mem8[QUEUE_LENGTH] = 2;
  const command = on.regs.a;
  oracle(on);
  assert.equal(on.mem8[QUEUE_LENGTH], 3, "with the flag set the count must step");
  assert.equal(on.mem8[QUEUE_LENGTH + 3], command, "and the caller's code must land at the tail");

  const off = entryState().clone();
  off.mem8[PLAY_ACTIVE] = 0x00;
  off.mem8[QUEUE_LENGTH] = 2;
  const before = off.mem8[QUEUE_LENGTH + 3];
  oracle(off);
  assert.equal(off.mem8[QUEUE_LENGTH], 2, "with the flag clear the count must not move");
  assert.equal(off.mem8[QUEUE_LENGTH + 3], before, "nor may the cell past the tail be written");
  console.log("  BRANCHES: posting appends and steps the count; dropping leaves both alone");
});

test("EXHAUSTIVE over the queue length", { skip }, () => {
  for (let length = 0; length < 256; length++) {
    const d = craftedDiff(loc_560c, 0xff, 0x01, length);
    assert.equal(d, null, `length=${length}: ${show(d)}`);
  }
  console.log("  EXHAUSTIVE: 256 queue lengths identical on the posting branch");
});

// ── teeth ───────────────────────────────────────────────────────────────────────────────

/** BUG: does nothing at all. */
function brokenNoOp() {}

/** BUG: posts unconditionally, which is the neighbouring entry's behaviour, not this one's. */
function brokenUngated(m) {
  loc_562a(m, m.regs.a);
}

/** BUG: reads the flag the wrong way round, so it sounds only in attract. */
function brokenInverted(m) {
  if (m.mem8[PLAY_ACTIVE] !== 0) return;
  loc_562a(m, m.regs.a);
}

/** BUG: also lets the demo-sound switch through, which is the OTHER sibling's behaviour. */
function brokenAlsoDemo(m) {
  if (m.mem8[PLAY_ACTIVE] === 0 && m.mem8[DEMO_SOUNDS] === 0) return;
  loc_562a(m, m.regs.a);
}

/** BUG: requires BOTH cells, so a genuine in-game request is dropped when demo sound is off. */
function brokenRequiresBoth(m) {
  if (m.mem8[PLAY_ACTIVE] === 0 || m.mem8[DEMO_SOUNDS] === 0) return;
  loc_562a(m, m.regs.a);
}

const TWINS = [
  ["no-op", brokenNoOp],
  ["ungated", brokenUngated],
  ["inverted", brokenInverted],
  ["also-demo", brokenAlsoDemo],
  ["requires-both", brokenRequiresBoth],
];

for (const [label, twin] of TWINS) {
  test(`TEETH: the ${label} twin is CAUGHT in the crafted cross`, { skip }, () => {
    const caught = crossCaught(twin);
    assert.ok(caught > 0, `the cross PASSED the ${label} twin — it has no teeth`);
    const first = [...Array(256).keys()]
      .flatMap((p) => DEMO_VALUES.map((dm) => craftedDiff(twin, p, dm, 3)))
      .find(Boolean);
    console.log(`  TEETH/${label}: caught on ${caught}/${CROSS_SIZE} — first ${show(first)}`);
  });
}

test("TEETH: the real dispatch alone is BLIND to three of them, and the cross is not", { skip }, () => {
  const blind = TWINS.filter(([, twin]) => realDispatchDiff(twin) === null).map(([l]) => l);
  assert.deepEqual(
    blind,
    ["ungated", "also-demo", "requires-both"],
    "the set of behaviours the real dispatch cannot discriminate moved — re-derive the cross",
  );
  for (const label of blind) {
    assert.ok(crossCaught(TWINS.find(([l]) => l === label)[1]) > 0, `${label} escapes both`);
  }
  console.log(`  TEETH: real-dispatch-blind but cross-caught — ${blind.join(", ")}`);
});
