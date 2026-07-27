// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for addScore (ROM 0x4689) — the shared scorer: it folds a
 * packed-BCD increment into the active player's two-byte score (0x8031 low pair, 0x8034
 * high pair, with the low->high carry) and repaints the four on-screen digits, but only
 * while the game mode marks player 1 or 2 in play; any other mode drops the whole award.
 *
 * WHY CRAFTED-ENTRY. The scorer is never reached in attract — 0x4689 is never dispatched
 * or m.call'd across a 1500-frame attract run (the demo does not drive it in that window),
 * so the capture/replay harness cannot hook it directly; test 0 pins that down. So the gate
 * captures real attract states at the per-frame service and runs the scorer's entry from
 * them, poking the mode gate identically on both sides to reach each path — the doc's
 * crafted-entry technique for an arm attract never runs.
 *
 * THE CONTRACT is memory-equivalence: whole RAM (dumpState), never pc / SP / the full
 * register file. The tail-jump into the digit repaint means the oracle only ever READS the
 * stack (one ret) and writes no stack byte, so — unlike the sound-award siblings — there is
 * no dead stack scratch to exclude and the RAM diff is whole-RAM. The increment is a genuine
 * register live-in the callers stage in the register pair; here it is an honest parameter,
 * set on the oracle's register pair and passed to addScore as an argument, so both sides add
 * the same amount.
 *
 * Seven checks:
 *   0. UNREACHED — unitEquivalence cannot capture 0x4689 in attract (never entered), which is
 *      exactly why the gate is crafted-entry.
 *   1. IDENTITY — the crafted-entry harness reports EQUAL when both arms are the oracle.
 *   2. EQUAL (real skip path) — on the real captured attract states (their own idle mode),
 *      addScore == oracle over whole RAM and the score is untouched.
 *   3. EQUAL (poked skip path) — mode forced idle (0, then 3): score untouched, whole RAM
 *      identical.
 *   4. EQUAL (add path, curated) — mode forced active (1, then 2) over valid-BCD scores
 *      including low->high carry and a nonzero high increment byte (which the shipped callers
 *      never pass but the shared adder does read): whole RAM identical, and the score really
 *      advanced by the increment.
 *   5. EQUAL (add path, exhaustive) — every valid packed-BCD score (low x high) times the
 *      real increments {1, 10, 20} on both player columns: the two score bytes and the four
 *      repainted digit cells match the oracle.
 *   6. TEETH — a dropped add, a wrong increment, a lost low->high carry, and an ignored mode
 *      gate are each CAUGHT at the expected address.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4689.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4689 as oracle } from "../../translated/loc_4689.js";
import { loc_0066 as nmiOracle } from "../../translated/loc_0066.js";
import { addScore } from "../addScore.js";
import { drawScoreDigits } from "../drawScoreDigits.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence } from "../../../../core/equivalence.js";
import { GAME_MODE, GAME_STATE2 } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x4689;
const NMI = 0x0066;
const SCORE_LOW = 0x8031; // low pair of the two-byte packed-BCD score (not yet named in ram.js)
const SCORE_HIGH = 0x8034; // high pair of the score
const P1_COLUMN = 0x9301; // player-1 score column base (drawScoreDigits picks by GAME_STATE2)
const OTHER_COLUMN = 0x90c1; // any-other-player score column base
const ROW = 32; // per-digit tile-map row stride
const SAFE_SP = 0x83f0; // a work-RAM stack the oracle's ret can pop harmlessly in crafted sweeps
const CAP_FRAMES = 1500;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// Packed-BCD helpers, mirroring the routine — used to build valid scores and broken twins.
const fromBcd = (b) => (b >> 4) * 10 + (b & 0x0f);
const toBcd = (n) => (Math.floor(n / 10) << 4) | n % 10;

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- capture ------------------------------------------------------------------

/** Sample realistic attract machine states at the per-frame service (single run — no NMI-timing skew). */
function captureAttractStates(K, maxFrames) {
  const caps = [];
  let ticks = 0;
  const snapshot = new Map([[NMI, (mm) => {
    ticks += 1;
    if (ticks % 97 === 0 && caps.length < K) caps.push(mm.clone());
    return nmiOracle(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return caps;
}

// -- the memory-equivalence contract ------------------------------------------

/** First differing RAM byte between two machines (whole RAM, nothing excluded), or null. */
function ramDiff(a, b) {
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] !== db[i]) return { addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] };
  }
  return null;
}

/**
 * Run the oracle (which reads the increment from its register pair) on one clone of the
 * entry and a candidate (which takes the increment as an argument) on another, and diff
 * whole RAM. Returns { diffs, ram }.
 */
function scoreDiff(entry, fn, increment) {
  const o = entry.clone();
  o.regs.bc = increment;
  oracle(o);
  const c = entry.clone();
  fn(c, increment);

  const diffs = [];
  const ram = ramDiff(o, c);
  if (ram) diffs.push(`RAM@${hx(ram.addr)} oracle=${ram.a} cand=${ram.b}`);
  return { diffs, ram };
}

const columnFor = (player) => (player === 1 ? P1_COLUMN : OTHER_COLUMN);
const cellsOf = (m, base) => [0, ROW, 2 * ROW, 3 * ROW].map((o) => m.mem.read8((base + o) & 0xffff));

// -- broken twins (same (m, increment) shape as addScore) ---------------------

/** BUG: honours the mode gate and repaints, but never adds to the score. */
function twinDroppedAdd(m, _increment) {
  const { mem8 } = m;
  const mode = mem8[GAME_MODE];
  if (mode !== 1 && mode !== 2) return;
  drawScoreDigits(m);
}

/** BUG: adds a fixed wrong amount (packed-BCD 21) instead of the requested increment. */
function twinWrongIncrement(m, _increment) {
  addScore(m, 0x21);
}

/** BUG: adds the low byte but drops the carry into the high pair. */
function twinLostCarry(m, increment) {
  const { mem8 } = m;
  const mode = mem8[GAME_MODE];
  if (mode !== 1 && mode !== 2) return;
  const lowSum = fromBcd(mem8[SCORE_LOW]) + fromBcd(increment & 0xff);
  mem8[SCORE_LOW] = toBcd(lowSum % 100);
  const highSum = fromBcd(mem8[SCORE_HIGH]) + fromBcd(increment >> 8); // BUG: no carry
  mem8[SCORE_HIGH] = toBcd(highSum % 100);
  drawScoreDigits(m);
}

/** BUG: adds unconditionally, ignoring the active-player gate. */
function twinIgnoreGate(m, increment) {
  const { mem8 } = m;
  const lowSum = fromBcd(mem8[SCORE_LOW]) + fromBcd(increment & 0xff);
  const carry = lowSum >= 100 ? 1 : 0;
  mem8[SCORE_LOW] = toBcd(lowSum % 100);
  const highSum = fromBcd(mem8[SCORE_HIGH]) + fromBcd(increment >> 8) + carry;
  mem8[SCORE_HIGH] = toBcd(highSum % 100);
  drawScoreDigits(m);
}

// -- 0. UNREACHED: 0x4689 never dispatches in attract -------------------------

test("UNREACHED: unitEquivalence cannot capture 0x4689 in attract (so the gate is crafted-entry)", () => {
  assert.throws(
    () => unitEquivalence(makeMachine, TARGET, oracle, addScore, { maxFrames: CAP_FRAMES }),
    /never entered/,
    "expected 0x4689 to be never dispatched/m.call'd in attract — if it now is, prefer a real-dispatch gate",
  );
  console.log("  UNREACHED: 0x4689 never entered in a 1500-frame attract run — crafted-entry gate it is");
});

// -- 1. IDENTITY -------------------------------------------------------------

test("IDENTITY: crafted-entry harness reports EQUAL when both arms are the oracle", () => {
  const caps = captureAttractStates(6, CAP_FRAMES);
  assert.ok(caps.length >= 3, `expected several captured attract states, got ${caps.length}`);
  for (const cap of caps) {
    const { diffs } = scoreDiff(cap, oracle, 0x0020); // oracle vs oracle
    assert.equal(diffs.length, 0, "identity must be EQUAL: " + diffs.join("; "));
  }
  console.log(`  IDENTITY: oracle vs oracle EQUAL over ${caps.length} captured attract states`);
});

// -- 2. EQUAL: real skip path -------------------------------------------------

test("EQUAL (real skip path): addScore == oracle on the real captured attract states; score untouched", () => {
  const caps = captureAttractStates(10, CAP_FRAMES);
  assert.ok(caps.length >= 4, `expected several captured attract states, got ${caps.length}`);
  const modes = new Set();
  for (const cap of caps) {
    modes.add(cap.mem.read8(GAME_MODE));
    const before = [cap.mem.read8(SCORE_LOW), cap.mem.read8(SCORE_HIGH)];
    const { diffs } = scoreDiff(cap, addScore, 0x0020);
    assert.equal(diffs.length, 0, `mode ${hx(cap.mem.read8(GAME_MODE))}: ${diffs.join("; ")}`);

    const c = cap.clone();
    addScore(c, 0x0020);
    assert.deepEqual(
      [c.mem.read8(SCORE_LOW), c.mem.read8(SCORE_HIGH)],
      before,
      "attract is not an active player, so the score must be untouched",
    );
  }
  // Attract really is the idle path (no active player), which is why the add arm is crafted.
  assert.ok(![...modes].some((m) => m === 1 || m === 2), `expected attract modes to be idle, saw ${[...modes].map(hx)}`);
  console.log(`  EQUAL/real-skip: ${caps.length} real states (modes ${[...modes].map(hx)}) identical; score untouched`);
});

// -- 3. EQUAL: poked skip path (modes 0, 3) -----------------------------------

test("EQUAL (poked skip path): modes 0 and 3 leave the score untouched, whole RAM identical", () => {
  const caps = captureAttractStates(8, CAP_FRAMES);
  assert.ok(caps.length >= 3, `expected several captured attract states, got ${caps.length}`);
  for (const idle of [0, 3]) {
    for (const cap of caps) {
      const entry = cap.clone();
      entry.mem.write8(GAME_MODE, idle);
      entry.mem.write8(SCORE_LOW, 0x45); // a nonzero score so a stray add would show
      entry.mem.write8(SCORE_HIGH, 0x67);
      const { diffs } = scoreDiff(entry, addScore, 0x0020);
      assert.equal(diffs.length, 0, `mode ${idle}: ${diffs.join("; ")}`);

      const c = entry.clone();
      addScore(c, 0x0020);
      assert.equal(c.mem.read8(SCORE_LOW), 0x45, `mode ${idle}: score low must be untouched`);
      assert.equal(c.mem.read8(SCORE_HIGH), 0x67, `mode ${idle}: score high must be untouched`);
    }
  }
  console.log("  EQUAL/poked-skip: modes 0 & 3 identical to the oracle; score untouched");
});

// -- 4. EQUAL: add path, curated ----------------------------------------------

test("EQUAL (add path, curated): modes 1 & 2 over valid-BCD scores (incl. carry + high inc byte); score advances", () => {
  const caps = captureAttractStates(4, CAP_FRAMES);
  assert.ok(caps.length >= 1, "need a capture to craft add-path entries from");
  const seed = caps[0];

  // [scoreLow, scoreHigh, increment, expectedLow, expectedHigh]
  const cases = [
    [0x12, 0x34, 0x0001, 0x13, 0x34], // +1, no carry
    [0x09, 0x00, 0x0001, 0x10, 0x00], // +1, nibble carry within the low byte
    [0x12, 0x34, 0x0010, 0x22, 0x34], // +10, no carry
    [0x00, 0x00, 0x0020, 0x20, 0x00], // +20 from zero
    [0x99, 0x00, 0x0001, 0x00, 0x01], // +1 rolls the low pair, carries into high
    [0x95, 0x12, 0x0010, 0x05, 0x13], // +10 carries into high
    [0x99, 0x99, 0x0020, 0x19, 0x00], // double roll: high wraps past 9999, fifth digit dropped
    [0x00, 0x00, 0x0105, 0x05, 0x01], // nonzero high increment byte (shared adder reads it)
    [0x50, 0x00, 0x0150, 0x00, 0x02], // high inc byte AND a low carry combine
  ];

  for (const player of [1, 2]) {
    for (const [lo, hi, inc, wantLo, wantHi] of cases) {
      const entry = seed.clone();
      entry.mem.write8(GAME_MODE, player); // active player -> the add lands
      entry.mem.write8(GAME_STATE2, player); // which score column drawScoreDigits repaints
      entry.mem.write8(SCORE_LOW, lo);
      entry.mem.write8(SCORE_HIGH, hi);

      const { diffs } = scoreDiff(entry, addScore, inc);
      assert.equal(diffs.length, 0, `player ${player} ${hx(lo)}/${hx(hi)} +${hx(inc)}: ${diffs.join("; ")}`);

      const c = entry.clone();
      addScore(c, inc);
      assert.equal(c.mem.read8(SCORE_LOW), wantLo, `player ${player} +${hx(inc)}: score low`);
      assert.equal(c.mem.read8(SCORE_HIGH), wantHi, `player ${player} +${hx(inc)}: score high`);
    }
  }
  console.log(`  EQUAL/add-curated: ${cases.length} cases x 2 players — whole RAM identical; score advanced as expected`);
});

// -- 5. EQUAL: add path, exhaustive over valid-BCD scores x real increments ----

/**
 * Sweep every valid packed-BCD score (low x high, 100 x 100) times the real award
 * increments on both player columns, comparing the two score bytes and the four repainted
 * digit cells. Two persistent machines are reused and re-seeded each iteration (the routine
 * writes only those bytes/cells); the oracle's ret pops a parked work-RAM stack harmlessly.
 */
function exhaustiveAddSweep(candidate) {
  const seed = captureAttractStates(1, CAP_FRAMES)[0];
  assert.ok(seed, "need a capture to seed the exhaustive sweep");
  const mo = seed.clone(), mi = seed.clone();
  let count = 0;
  for (const player of [1, 2]) {
    const base = columnFor(player);
    for (const inc of [0x0001, 0x0010, 0x0020]) {
      for (let hd = 0; hd < 100; hd++) {
        for (let ld = 0; ld < 100; ld++) {
          const lo = toBcd(ld), hi = toBcd(hd);
          for (const mm of [mo, mi]) {
            mm.regs.sp = SAFE_SP;
            mm.mem.write8(GAME_MODE, player);
            mm.mem.write8(GAME_STATE2, player);
            mm.mem.write8(SCORE_LOW, lo);
            mm.mem.write8(SCORE_HIGH, hi);
            for (const o of [0, ROW, 2 * ROW, 3 * ROW]) mm.mem.write8((base + o) & 0xffff, 0xaa);
          }
          mo.regs.bc = inc;
          oracle(mo);
          candidate(mi, inc);
          count++;
          if (mo.mem.read8(SCORE_LOW) !== mi.mem.read8(SCORE_LOW)) {
            return { mismatch: { player, inc, lo, hi, where: "low", want: mo.mem.read8(SCORE_LOW), got: mi.mem.read8(SCORE_LOW) }, count };
          }
          if (mo.mem.read8(SCORE_HIGH) !== mi.mem.read8(SCORE_HIGH)) {
            return { mismatch: { player, inc, lo, hi, where: "high", want: mo.mem.read8(SCORE_HIGH), got: mi.mem.read8(SCORE_HIGH) }, count };
          }
          const co = cellsOf(mo, base), ci = cellsOf(mi, base);
          for (let k = 0; k < 4; k++) {
            if (co[k] !== ci[k]) return { mismatch: { player, inc, lo, hi, where: `cell${k}`, want: co[k], got: ci[k] }, count };
          }
        }
      }
    }
  }
  return { mismatch: null, count };
}

test("EQUAL (add path, exhaustive): every valid-BCD score x {1,10,20} on both columns matches the oracle", () => {
  const { mismatch, count } = exhaustiveAddSweep(addScore);
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `mismatch player=${mismatch.player} +${hx(mismatch.inc)} score=${hx(mismatch.lo)}/${hx(mismatch.hi)} ` +
        `at ${mismatch.where}: oracle=${hx(mismatch.want)} idiomatic=${hx(mismatch.got)}`,
  );
  assert.equal(count, 60000, "must have swept both columns x 3 increments over the full valid-BCD domain");
  console.log(`  EQUAL/add-exhaustive: ${count} (player,increment,score) combinations identical (score bytes + digit cells)`);
});

// -- 6. TEETH -----------------------------------------------------------------

test("TEETH: dropped add / wrong increment / lost carry / ignored gate are each CAUGHT", () => {
  const seed = captureAttractStates(1, CAP_FRAMES)[0];
  assert.ok(seed, "need a capture to seed the teeth checks");

  // Active-player seed with a low pair that will carry, so the carry teeth can bite.
  const active = seed.clone();
  active.mem.write8(GAME_MODE, 1);
  active.mem.write8(GAME_STATE2, 1);
  active.mem.write8(SCORE_LOW, 0x99);
  active.mem.write8(SCORE_HIGH, 0x12);

  const dropped = scoreDiff(active, twinDroppedAdd, 0x0020);
  assert.ok(dropped.diffs.length > 0, "the gate FAILED to catch the dropped-add twin — it proves nothing");
  assert.equal(dropped.ram.addr, SCORE_LOW, `dropped-add caught at ${hx(dropped.ram.addr)} (expected ${hx(SCORE_LOW)})`);

  const wrong = scoreDiff(active, twinWrongIncrement, 0x0010);
  assert.ok(wrong.diffs.length > 0, "the gate FAILED to catch the wrong-increment twin — it proves nothing");
  assert.equal(wrong.ram.addr, SCORE_LOW, `wrong-increment caught at ${hx(wrong.ram.addr)} (expected ${hx(SCORE_LOW)})`);

  const lostCarry = scoreDiff(active, twinLostCarry, 0x0020);
  assert.ok(lostCarry.diffs.length > 0, "the gate FAILED to catch the lost-carry twin — it proves nothing");
  assert.equal(lostCarry.ram.addr, SCORE_HIGH, `lost-carry caught at ${hx(lostCarry.ram.addr)} (expected ${hx(SCORE_HIGH)})`);

  // Idle seed so the mode gate is load-bearing: the oracle adds nothing, the twin does.
  const idle = seed.clone();
  idle.mem.write8(GAME_MODE, 0);
  idle.mem.write8(SCORE_LOW, 0x45);
  idle.mem.write8(SCORE_HIGH, 0x67);
  const ignoreGate = scoreDiff(idle, twinIgnoreGate, 0x0020);
  assert.ok(ignoreGate.diffs.length > 0, "the gate FAILED to catch the ignore-gate twin — it proves nothing");
  assert.equal(ignoreGate.ram.addr, SCORE_LOW, `ignore-gate caught at ${hx(ignoreGate.ram.addr)} (expected ${hx(SCORE_LOW)})`);

  console.log(
    `  TEETH: dropped@${hx(dropped.ram.addr)} wrong-inc@${hx(wrong.ram.addr)} ` +
      `lost-carry@${hx(lostCarry.ram.addr)} ignore-gate@${hx(ignoreGate.ram.addr)} — all caught`,
  );
});
