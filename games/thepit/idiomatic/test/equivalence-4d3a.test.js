// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for insertHighScore (ROM 0x4d3a) — the "BEST SCORES TODAY" insert.
 *
 * insertHighScore takes no register inputs and reads/writes only the high-score block
 * (the candidate score bytes, the three 5-byte ranked records, and the landed-rank
 * result byte), so it behaves as a pure leaf over that block. Attract never inserts a
 * score (0 dispatches over 6000 frames), so it is gated by the CRAFTED-ENTRY method: a
 * real booted machine is nudged across the table's whole input domain, poked
 * IDENTICALLY on both sides, and the oracle's RAM is diffed against the idiomatic one.
 *
 *   1. EQUAL (boundary domain) — every behaviourally-distinct arm: below/at/above each
 *      rank (ties land just below), plus high-byte-tie cases that force the low-byte
 *      compare at each rank. Oracle vs idiomatic must leave IDENTICAL work RAM.
 *
 *   2. EQUAL (randomized sweep) — thousands of seeded random (candidate, table,
 *      initials) states; the two implementations must agree on every one.
 *
 *   3. NO-STACK — insertHighScore models no stack: it leaves SP and the return address
 *      exactly as found (the oracle's own `ret` pops, but that is dead ABI here).
 *
 *   4. TEETH — a deliberately-broken twin that uses a strict `<` where the tie rule
 *      needs `<=` (the classic "does an equal score make the board?" bug) MUST be
 *      caught: on a tie it wrongly places the score and stamps initials the oracle left
 *      alone. A gate that cannot catch that is worthless.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4d3a.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4d3a as oracle } from "../../translated/loc_4d3a.js";
import { insertHighScore } from "../insertHighScore.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x4d3a;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// High-score block addresses (the routine's whole interface).
const CAND_LO = 0x8031, CAND_HI = 0x8034;
const SCORE = { 1: 0x803c, 2: 0x8041, 3: 0x8046 };
const INIT = { 1: 0x8039, 2: 0x803e, 3: 0x8043 };
const LANDED_RANK = 0x8048;

// The Pit's registry is async, so the factory is built once and closed over.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// A real booted machine to craft entries from; attract never inserts a score, so this
// realistic full-machine state has its high-score block overwritten per scenario.
const baseEntry = ROM_PRESENT ? (() => { const b = makeMachine(); b.runFrames(120); return b.clone(); })() : null;

/** Lay one scenario over the high-score block, identically on any machine. */
function setScene(m, s) {
  const { mem } = m;
  mem.write8(CAND_LO, s.cand & 0xff);
  mem.write8(CAND_HI, (s.cand >> 8) & 0xff);
  for (const r of [1, 2, 3]) {
    mem.write16(SCORE[r], s.scores[r]);
    const [a, b, c] = s.initials[r];
    mem.write8(INIT[r], a);
    mem.write8(INIT[r] + 1, b);
    mem.write8(INIT[r] + 2, c);
  }
  mem.write8(LANDED_RANK, 0); // the caller pre-clears the result so "no placement" reads 0
}

// Distinct, recognizable initials so a missed initials-shift copy shows up as a diff.
const DEFAULT_INITIALS = { 1: [0x11, 0x12, 0x13], 2: [0x21, 0x22, 0x23], 3: [0x31, 0x32, 0x33] };
const scene = (cand, r1, r2, r3, initials = DEFAULT_INITIALS) => ({
  cand,
  scores: { 1: r1, 2: r2, 3: r3 },
  initials,
});

/** Run oracle and candidate on fresh clones of a scenario; return the first RAM diff. */
function diffScene(s, candidate) {
  const a = baseEntry.clone();
  const b = baseEntry.clone();
  setScene(a, s);
  setScene(b, s);
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// -- 1. EQUAL (boundary domain) -----------------------------------------------

test("EQUAL (boundary): insertHighScore == oracle on every distinct placement arm", () => {
  const cases = [
    // Ordered table 0x5000/0x3000/0x1000 — one candidate per relational position.
    ["below rank3", scene(0x0500, 0x5000, 0x3000, 0x1000)],
    ["tie rank3", scene(0x1000, 0x5000, 0x3000, 0x1000)],
    ["land rank3", scene(0x2000, 0x5000, 0x3000, 0x1000)],
    ["tie rank2", scene(0x3000, 0x5000, 0x3000, 0x1000)],
    ["land rank2", scene(0x4000, 0x5000, 0x3000, 0x1000)],
    ["tie rank1", scene(0x5000, 0x5000, 0x3000, 0x1000)],
    ["land rank1", scene(0x6000, 0x5000, 0x3000, 0x1000)],
    // High bytes all 0x20 so the compares fall through to the low byte at each rank.
    ["hi-tie r3 low<", scene(0x207f, 0x20f0, 0x2090, 0x2080)],
    ["hi-tie r3 low=", scene(0x2080, 0x20f0, 0x2090, 0x2080)],
    ["hi-tie r3 low>", scene(0x2081, 0x20f0, 0x2090, 0x2080)],
    ["hi-tie r2 low<", scene(0x208f, 0x20f0, 0x2090, 0x2080)],
    ["hi-tie r2 low=", scene(0x2090, 0x20f0, 0x2090, 0x2080)],
    ["hi-tie r2 low>", scene(0x2091, 0x20f0, 0x2090, 0x2080)],
    ["hi-tie r1 low<", scene(0x20ef, 0x20f0, 0x2090, 0x2080)],
    ["hi-tie r1 low=", scene(0x20f0, 0x20f0, 0x2090, 0x2080)],
    ["hi-tie r1 low>", scene(0x20f1, 0x20f0, 0x2090, 0x2080)],
    // Extremes.
    ["max candidate", scene(0xffff, 0x5000, 0x3000, 0x1000)],
    ["zero candidate", scene(0x0000, 0x5000, 0x3000, 0x0000)],
  ];
  for (const [label, s] of cases) {
    const d = diffScene(s, insertHighScore);
    assert.equal(
      d,
      null,
      d && `${label}: RAM diff at ${hx(d.addr ?? 0)} (oracle=${d.a} idiomatic=${d.b})`,
    );
  }
  console.log(`  EQUAL/boundary: ${cases.length} placement arms identical to the oracle`);
});

// -- 2. EQUAL (randomized sweep) ----------------------------------------------

test("EQUAL (random): insertHighScore == oracle over thousands of random states", () => {
  let seed = 0x1234abcd >>> 0;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed;
  };
  const r16 = () => rnd() & 0xffff;
  const r8 = () => rnd() & 0xff;

  const N = 5000;
  let firstBad = null;
  for (let i = 0; i < N && !firstBad; i++) {
    // Half the states use a sorted (realistic) table; half are fully random so the
    // compares are exercised even when the table is not descending.
    let r1, r2, r3;
    if (i % 2 === 0) {
      const v = [r16(), r16(), r16()].sort((x, y) => y - x);
      [r1, r2, r3] = v;
    } else {
      [r1, r2, r3] = [r16(), r16(), r16()];
    }
    // Bias the candidate toward the table's neighbourhood so ties/boundaries recur.
    const cand = (i % 3 === 0) ? [r1, r2, r3][rnd() % 3] : r16();
    const initials = { 1: [r8(), r8(), r8()], 2: [r8(), r8(), r8()], 3: [r8(), r8(), r8()] };
    const s = scene(cand, r1, r2, r3, initials);
    const d = diffScene(s, insertHighScore);
    if (d) firstBad = { i, s, d };
  }
  assert.equal(
    firstBad,
    null,
    firstBad &&
      `mismatch #${firstBad.i} cand=${hx(firstBad.s.cand)} ` +
        `table=${hx(firstBad.s.scores[1])}/${hx(firstBad.s.scores[2])}/${hx(firstBad.s.scores[3])} ` +
        `at ${hx(firstBad.d.addr ?? 0)} (oracle=${firstBad.d.a} idiomatic=${firstBad.d.b})`,
  );
  console.log(`  EQUAL/random: ${N} random states identical to the oracle`);
});

// -- 3. NO-STACK --------------------------------------------------------------

test("NO-STACK: insertHighScore leaves SP and the return address untouched", () => {
  const b = baseEntry.clone();
  setScene(b, scene(0x6000, 0x5000, 0x3000, 0x1000));
  const sp0 = b.regs.sp;
  const pc0 = b.pc;
  insertHighScore(b);
  assert.equal(b.regs.sp, sp0, "insertHighScore must leave SP unchanged (it models no stack)");
  assert.equal(b.pc, pc0, "insertHighScore must leave pc unchanged (it models no return)");
  console.log("  NO-STACK: SP and pc unchanged");
});

// -- 4. TEETH -----------------------------------------------------------------

/**
 * Broken twin: uses a strict `<` where the tie rule needs `<=`. On a score equal to an
 * existing entry the oracle returns unchanged, but this places it anyway — corrupting
 * the table and stamping initials the oracle never touched.
 */
function brokenInsert(m) {
  const { mem } = m;
  const scoreAddr = (r) => 0x8039 + 5 * (r - 1) + 3;
  const initAddr = (r) => 0x8039 + 5 * (r - 1);
  const cand = (mem.read8(CAND_HI) << 8) | mem.read8(CAND_LO);
  const land = (r) => {
    mem.write16(scoreAddr(r), cand);
    mem.write8(LANDED_RANK, r);
    const i = initAddr(r);
    mem.write8(i, 0xff);
    mem.write8(i + 1, 0xff);
    mem.write8(i + 2, 0xff);
  };
  const shift = (f, t) => {
    mem.write16(scoreAddr(t), mem.read16(scoreAddr(f)));
    const a = initAddr(f), b = initAddr(t);
    mem.write8(b, mem.read8(a));
    mem.write8(b + 1, mem.read8(a + 1));
    mem.write8(b + 2, mem.read8(a + 2));
  };
  if (cand < mem.read16(scoreAddr(3))) return; // BUG: `<` should be `<=`
  if (cand < mem.read16(scoreAddr(2))) { land(3); return; }
  shift(2, 3);
  if (cand < mem.read16(scoreAddr(1))) { land(2); return; }
  shift(1, 2);
  land(1);
}

test("TEETH: the strict-`<` tie bug is CAUGHT", () => {
  // Deterministic tie with rank 3: the oracle makes no change; the broken twin places.
  const tie = scene(0x1000, 0x5000, 0x3000, 0x1000);
  const d = diffScene(tie, brokenInsert);
  assert.notEqual(d, null, "the gate FAILED to catch the strict-`<` tie bug — it is worthless");
  console.log(`  TEETH: caught at ${hx(d.addr ?? 0)} (oracle=${d.a} broken=${d.b})`);

  // ...and it is caught somewhere in the randomized sweep too.
  let seed = 0x0f0f0f0f >>> 0;
  const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0);
  let caught = false;
  for (let i = 0; i < 4000 && !caught; i++) {
    const v = [rnd() & 0xffff, rnd() & 0xffff, rnd() & 0xffff].sort((x, y) => y - x);
    const cand = [v[0], v[1], v[2]][rnd() % 3]; // bias to exact ties
    const s = scene(cand, v[0], v[1], v[2]);
    if (diffScene(s, brokenInsert)) caught = true;
  }
  assert.equal(caught, true, "the randomized sweep FAILED to catch the tie bug");
  console.log("  TEETH/sweep: the tie bug is caught in the randomized sweep too");
});
