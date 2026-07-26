// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for drawScoreDigits (ROM 0x46af) — the HUD score repaint: it
 * splits the two packed BCD score bytes (0x8031 low pair, 0x8034 high pair) into
 * four digit cells of the active player's score column (base chosen by 0x8002),
 * with leading-zero blanking on the high pair, and hands the column base back in IX.
 *
 * The routine WRITES MEMORY (four tile cells) and returns a register (the column
 * base, which the still-oracle HUD-redraw caller loc_472c reads to blank the cells
 * above), so it is gated on memory-equivalence (RAM − nothing, plus that one live
 * register + pc + SP), never the full register file, never cycles. It is dispatched
 * for real during boot, but only with an all-zero attract score, so the blanking
 * arms are covered by an exhaustive sweep over crafted inputs.
 *
 *   1. REALISM — the real boot dispatches (player 1 and player 2 columns, all-zero
 *      score) leave RAM + IX + pc + SP identical to the oracle.
 *   2. EQUAL (exhaustive) — for every (player∈{1,2}, low byte, high byte), all
 *      131,072 combinations, drawScoreDigits writes the same four cells and returns
 *      the same column base as the oracle. This covers both column bases and every
 *      leading-zero-blank arm.
 *   3. EQUAL (contract) — on a curated set, run oracle vs idiomatic on fresh clones
 *      and confirm identical whole RAM + pc + SP + IX. This proves nothing OUTSIDE
 *      the four cells is touched.
 *   4. TEETH (exhaustive) — two deliberately-broken twins the sweep MUST catch: one
 *      that never blanks the leading zero, and one that forgets to hand back the
 *      column base. A gate a real corruption slips through is worthless.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-46af.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_46af as oracle } from "../../translated/loc_46af.js";
import { drawScoreDigits } from "../drawScoreDigits.js";
import { makeMachineFactory } from "../../machine.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x46af;
const PLAYER = 0x8002; // active player index (GAME_STATE2)
const LO = 0x8031; // score low BCD byte
const HI = 0x8034; // score high BCD byte
const P1_BASE = 0x9301; // player-1 score column
const OTHER_BASE = 0x90c1; // any-other-player score column
const ROW = 32; // per-digit tile-map row stride
const SAFE_SP = 0x83f0; // a work-RAM stack the oracle's ret can pop harmlessly
const hx = (v) => "0x" + (v & 0xffff).toString(16);

const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// A real captured machine — booted a few frames, then frozen — to seed crafted
// entries with realistic RAM. clone() neutralises its frame machinery.
const seed = ROM_PRESENT ? (() => { const h = makeMachine(); h.runFrames(60); return h.clone(); })() : null;

const baseFor = (player) => (player === 1 ? P1_BASE : OTHER_BASE);
const cellsOf = (m, base) => [0, ROW, 2 * ROW, 3 * ROW].map((o) => m.mem.read8((base + o) & 0xffff));

/**
 * Boot a plain machine and clone it at each real 0x46af dispatch (capped at K). The
 * wrapper clones the entry, then runs the oracle so the host boot proceeds to a clean
 * stop; capturing is gated off afterwards so the isolated replays cannot pollute it.
 */
function captureBootDispatches(K, maxFrames) {
  const caps = [];
  let capturing = true;
  const snap = new Map([[TARGET, (mm) => {
    if (capturing && caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = makeMachine(snap);
  host.runFrames(maxFrames);
  capturing = false;
  return caps;
}

/** First RAM byte that differs, or null. The routine pushes nothing — no stack region to exclude. */
function firstRamDiff(a, b) {
  const da = a.dumpState(), db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] !== db[i]) return { addr: a.stateOffsetToAddr(i), a: da[i], b: db[i] };
  }
  return null;
}

/**
 * Full memory-equivalence contract on one entry: run the oracle on one clone (it
 * rets internally) and the idiomatic on another (then one ret to line up pc + SP,
 * since the idiomatic uses the JS call stack), and diff whole RAM + pc + SP + IX.
 */
function contractDiffs(entry) {
  const o = entry.clone(); oracle(o);
  const c = entry.clone(); drawScoreDigits(c); c.ret();
  const diffs = [];
  const ram = firstRamDiff(o, c);
  if (ram) diffs.push(`RAM@${hx(ram.addr ?? 0)} oracle=${hx(ram.a)} idiomatic=${hx(ram.b)}`);
  if ((o.regs.ix & 0xffff) !== (c.regs.ix & 0xffff)) diffs.push(`IX oracle=${hx(o.regs.ix)} idiomatic=${hx(c.regs.ix)}`);
  if (o.pc !== c.pc) diffs.push(`pc oracle=${hx(o.pc)} idiomatic=${hx(c.pc)}`);
  if ((o.regs.sp & 0xffff) !== (c.regs.sp & 0xffff)) diffs.push(`SP oracle=${hx(o.regs.sp)} idiomatic=${hx(c.regs.sp)}`);
  return diffs;
}

// -- 1. REALISM (the real boot dispatches) ------------------------------------

test("REALISM: drawScoreDigits == oracle on the real boot dispatches (both columns)", () => {
  const caps = captureBootDispatches(4, 200);
  assert.ok(caps.length >= 2, `expected at least two real 0x46af dispatches during boot, got ${caps.length}`);
  const players = new Set();
  for (const entry of caps) {
    players.add(entry.mem.read8(PLAYER));
    const diffs = contractDiffs(entry);
    assert.equal(diffs.length, 0, `player=${entry.mem.read8(PLAYER)}: ${diffs.join("; ")}`);
  }
  // The two arms (player 1 -> 0x9301, player 2 -> 0x90c1) both fire during boot.
  assert.ok(players.has(1) && players.has(2), `expected both player arms, saw ${[...players]}`);
  console.log(`  REALISM: ${caps.length} real dispatches (players ${[...players]}) identical on RAM + IX + pc + SP`);
});

// -- 2. EQUAL (exhaustive over both columns and all 65,536 packed values) ------

/**
 * Sweep every (player, low, high) against the oracle, comparing the four written
 * cells and the returned column base (IX). Two persistent machines are reused (the
 * routine only writes those cells and reads only the three input bytes), re-seeded
 * each iteration; SP is parked in work RAM so the oracle's ret pops harmlessly.
 */
function exhaustiveSweep(candidate) {
  const mo = seed.clone(), mi = seed.clone();
  let count = 0;
  for (const player of [1, 2]) {
    const base = baseFor(player);
    for (let hi = 0; hi < 256; hi++) {
      for (let lo = 0; lo < 256; lo++) {
        for (const mm of [mo, mi]) {
          mm.regs.sp = SAFE_SP;
          mm.mem.write8(PLAYER, player);
          mm.mem.write8(LO, lo);
          mm.mem.write8(HI, hi);
          for (const o of [0, ROW, 2 * ROW, 3 * ROW]) mm.mem.write8((base + o) & 0xffff, 0xaa);
        }
        oracle(mo);
        candidate(mi);
        count++;
        const co = cellsOf(mo, base), ci = cellsOf(mi, base);
        for (let k = 0; k < 4; k++) {
          if (co[k] !== ci[k]) return { mismatch: { player, hi, lo, k, want: co[k], got: ci[k] }, count };
        }
        if ((mo.regs.ix & 0xffff) !== (mi.regs.ix & 0xffff)) {
          return { mismatch: { player, hi, lo, k: "ix", want: mo.regs.ix & 0xffff, got: mi.regs.ix & 0xffff }, count };
        }
      }
    }
  }
  return { mismatch: null, count };
}

test("EQUAL (exhaustive): drawScoreDigits == oracle over both columns and all 65,536 values", () => {
  const { mismatch, count } = exhaustiveSweep(drawScoreDigits);
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `mismatch player=${mismatch.player} hi=${hx(mismatch.hi)} lo=${hx(mismatch.lo)} cell=${mismatch.k}: ` +
        `oracle=${hx(mismatch.want)} idiomatic=${hx(mismatch.got)}`,
  );
  assert.equal(count, 131072, "must have swept both columns over the full 65,536-value domain");
  console.log(`  EQUAL/exhaustive: ${count} (player,score) combinations identical to the oracle (cells + column base)`);
});

// -- 3. EQUAL (whole-RAM + pc + SP + IX contract) -----------------------------

/** Build a curated entry: a real seed clone with player + score + a safe stack poked. */
function craft(player, hi, lo) {
  const e = seed.clone();
  e.regs.sp = SAFE_SP;
  e.mem.write8(PLAYER, player);
  e.mem.write8(HI, hi);
  e.mem.write8(LO, lo);
  return e;
}

test("EQUAL (contract): identical whole RAM + pc + SP + IX, so nothing outside the cells is touched", () => {
  const cases = [
    [1, 0x00, 0x00], // all zero: whole high pair blanked, low pair "00"
    [1, 0x01, 0x23], // leading-zero blank on the top digit only
    [2, 0x98, 0x76], // no blanking, all four digits shown (other column)
    [1, 0x10, 0x00], // top digit present, trailing zeros are real "0"s
    [2, 0x0f, 0xff], // top digit blanked, nibbles at max
    [1, 0xff, 0xff], // no blanking, all-max
    [2, 0x07, 0x00], // single leading digit then zeros
  ];
  for (const [player, hi, lo] of cases) {
    const diffs = contractDiffs(craft(player, hi, lo));
    assert.equal(diffs.length, 0, `player=${player} hi=${hx(hi)} lo=${hx(lo)}: ${diffs.join("; ")}`);
  }
  console.log(`  EQUAL/contract: ${cases.length} entries identical on whole RAM + pc + SP + IX`);
});

// -- 4. TEETH (exhaustive) ----------------------------------------------------

/** Broken twin A: draws the leading digit even when it is zero (no blanking).
 *  Diverges on every value whose leading digit is zero. */
function brokenNoBlank(m) {
  const { regs, mem } = m;
  const base = mem.read8(PLAYER) === 1 ? P1_BASE : OTHER_BASE;
  const low = mem.read8(LO);
  mem.write8(base, low & 0x0f);
  mem.write8(base + ROW, low >> 4);
  const high = mem.read8(HI);
  mem.write8(base + 3 * ROW, high >> 4); // BUG: never blanks the leading zero
  mem.write8(base + 2 * ROW, high & 0x0f); // BUG: never blanks the second digit
  regs.ix = base;
}

/** Broken twin B: correct cells, but forgets to hand back the column base. */
function brokenNoIx(m) {
  drawScoreDigits(m);
  m.regs.ix = 0x8028; // BUG: leaves the entry IX instead of the column base
}

test("TEETH (exhaustive): the no-leading-blank twin is CAUGHT by the sweep", () => {
  const { mismatch, count } = exhaustiveSweep(brokenNoBlank);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a twin that skips leading-zero blanking — it is worthless");
  console.log(
    `  TEETH/no-blank: caught after ${count} combinations at player=${mismatch.player} ` +
      `hi=${hx(mismatch.hi)} lo=${hx(mismatch.lo)} cell=${mismatch.k} (oracle=${hx(mismatch.want)} broken=${hx(mismatch.got)})`,
  );
});

test("TEETH (exhaustive): the dropped-column-base twin is CAUGHT by the sweep", () => {
  const { mismatch, count } = exhaustiveSweep(brokenNoIx);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a twin that drops the IX live-out — it is worthless");
  assert.equal(mismatch.k, "ix", `expected the IX live-out to be caught, got cell ${mismatch.k}`);
  console.log(`  TEETH/no-ix: caught after ${count} combinations (oracle base=${hx(mismatch.want)} broken=${hx(mismatch.got)})`);
});
