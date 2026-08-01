// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2797 (ROM 0x2797) — the 0x6600 board-object animator.
 *
 * sub_2797 walks six 16-byte object records at 0x6600 and, for each ACTIVE one,
 * drifts its Y one pixel and lands/deactivates it at a limit. It is a LEAF whose
 * memory-observable effect on a record is a pure function of THREE bytes of that
 * record — OBJ_ACTIVE (+0, only bit0), OBJ_STATE (+0x0d, only bit3), and OBJ_Y
 * (+5, the whole byte) — and writes only OBJ_Y / OBJ_ACTIVE / OBJ_X / OBJ_STATE.
 * The six records are independent (each field is inside its own 16-byte stride), so
 * the effect factorises: one record's transition logic swept EXHAUSTIVELY, plus one
 * all-six entry to prove the loop covers every record at the right stride.
 *
 * There is also ONE register live-out: the record stride (DE = 0x0010). The oracle
 * loads it as its walk stride and leaves it untouched; the caller (0x2722) forwards
 * it straight into the sibling spawn walk (sub_27da) as ITS stride without reloading.
 * loc_2797 RETURNS that stride, and every sweep asserts the return equals the DE the
 * oracle leaves.
 *
 * Contract: RAM (whole dump — the oracle only READS the stack via its terminal `ret`,
 * so no stack byte is written and no exclusion is needed) + the returned live-out.
 *
 *   1. EQUAL (exhaustive) — one record swept over ACTIVE bytes {0x00,0x01,0xFE,0xFF}
 *      (bit0 both ways, with noise to pin the mask) × STATE bytes {0x00,0x08,0xF7,0xFF}
 *      (bit3 both ways, with noise) × all 256 Y values = 4096 combos. RAM and the
 *      returned stride identical to the oracle on every one.
 *
 *   2. LANDMARKS — prove the sweep is not vacuous: the oracle genuinely reaches the
 *      LAND transition, the DEACTIVATE transition, an inactive skip, and both
 *      non-terminal drifts, and loc_2797 reproduces each.
 *
 *   3. EQUAL (all six) — one crafted entry with all six records active in varied
 *      states/Y (two at a terminal, at different indices), proving the loop walks all
 *      six at stride 16 and touches the right fields per record.
 *
 *   4. TEETH — deliberately-broken twins, each of which the SAME suite MUST catch:
 *        (a) wrong active mask  (bit1 not bit0)       — caught by the sweep.
 *        (b) wrong state mask   (bit2 not bit3)       — caught by the sweep.
 *        (c) wrong land threshold (lands at 0x61)     — caught by the sweep (OBJ_X).
 *        (d) no deactivate      (falling limit no-op) — caught by the sweep (OBJ_ACTIVE).
 *        (e) short loop         (only five records)   — caught by the all-six entry.
 *        (f) wrong live-out     (returns the wrong stride) — caught by the return check.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2797.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_2797 as oracle } from "../../translated/sub_2797.js";
import { loc_2797 } from "../loc_2797.js";
import { OBJ_ARRAY_66, OBJ_ACTIVE, OBJ_STATE, OBJ_X, OBJ_Y } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const STRIDE = 0x10;
const RECORD_COUNT = 6;
const EXPECTED_STRIDE = 0x0010; // the DE live-out the oracle leaves

// The oracle's terminal `ret` pops the stack; point SP at work RAM so the pop reads
// valid bytes (never I/O). It is a leaf that only POPS — it writes no RAM through the
// stack — so this choice never affects the compared memory.
const SAFE_SP = 0x6bf8;

// bit0 both ways, with noise in the other bits to prove ONLY bit0 gates active.
const ACTIVE_BYTES = [0x00, 0x01, 0xfe, 0xff];
// bit3 both ways, with noise in the other bits to prove ONLY bit3 picks the direction.
const STATE_BYTES = [0x00, 0x08, 0xf7, 0xff];

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");
const objAddr = (i) => OBJ_ARRAY_66 + i * STRIDE;

/**
 * A synthetic entry: a clone of `base` with all six records zeroed (so only the
 * records we set are exercised), then record 0 loaded with the swept bytes, a safe
 * stack, and the frame machinery neutralised (clone() already sets nextNmi/
 * nextBoundary = Infinity; re-asserted for clarity).
 */
function makeEntry(base, activeByte, stateByte, y) {
  const e = base.clone();
  for (let i = 0; i < RECORD_COUNT; i++) {
    const obj = objAddr(i);
    e.mem.write8(obj + OBJ_ACTIVE, 0x00);
    e.mem.write8(obj + OBJ_STATE, 0x00);
    e.mem.write8(obj + OBJ_X, 0x00);
    e.mem.write8(obj + OBJ_Y, 0x00);
  }
  e.mem.write8(objAddr(0) + OBJ_ACTIVE, activeByte);
  e.mem.write8(objAddr(0) + OBJ_STATE, stateByte);
  e.mem.write8(objAddr(0) + OBJ_Y, y);
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and the candidate on two FRESH, byte-identical entries and diff the
 * contract: RAM (whole dump) + the returned stride against the oracle's DE live-out.
 * A fresh entry per side because the routine WRITES memory.
 */
function runPair(base, activeByte, stateByte, y, candidate) {
  const a = makeEntry(base, activeByte, stateByte, y); // oracle
  const b = makeEntry(base, activeByte, stateByte, y); // candidate
  oracle(a);
  const ret = candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram, oracleDe: a.regs.de, candRet: ret };
}

/**
 * The exhaustive single-record sweep. Returns the first mismatch (RAM or live-out) or
 * null, and the total combos compared.
 */
function fullSweep(base, candidate) {
  let count = 0;
  for (const a of ACTIVE_BYTES) {
    for (const s of STATE_BYTES) {
      for (let y = 0; y < 256; y++) {
        const { ram, oracleDe, candRet } = runPair(base, a, s, y, candidate);
        count++;
        if (ram) return { mismatch: { a, s, y, kind: "ram", ram }, count };
        if (candRet !== oracleDe) {
          return { mismatch: { a, s, y, kind: "liveout", oracleDe, candRet }, count };
        }
      }
    }
  }
  return { mismatch: null, count };
}

const describeMismatch = (mm) => {
  if (!mm) return "no mismatch";
  const at = `at active=${hx(mm.a)} state=${hx(mm.s)} y=${hx(mm.y)}`;
  if (mm.kind === "ram") {
    return `${at}: RAM diverges at 0x${(mm.ram.addr ?? 0).toString(16)} (${mm.ram.a}->${mm.ram.b})`;
  }
  return `${at}: live-out diverges (oracle DE=${hx(mm.oracleDe)} cand return=${hx(mm.candRet)})`;
};

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): loc_2797 == oracle over the full one-record input space", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_2797);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, ACTIVE_BYTES.length * STATE_BYTES.length * 256, "must have compared the full swept space");
  console.log(`  EQUAL/exhaustive: ${count} (active, state, Y) combos — RAM + stride live-out identical to the oracle`);
});

// -- 2. LANDMARKS (non-vacuity) -----------------------------------------------

test("LANDMARKS: the oracle genuinely reaches land / deactivate / skip / drift, and loc_2797 matches", () => {
  const base = new Machine(ROM).clone();

  // (i) LAND: active, rising (bit3 set), Y one above the landing row.
  {
    const o = makeEntry(base, 0x01, 0x08, 0x61); oracle(o);
    assert.equal(o.mem.read8(objAddr(0) + OBJ_Y), 0x60, "rising object should reach the landing row");
    assert.equal(o.mem.read8(objAddr(0) + OBJ_X), 0x77, "landing should snap X");
    assert.equal(o.mem.read8(objAddr(0) + OBJ_STATE), 0x04, "landing should set OBJ_STATE = 4");
  }
  // (ii) DEACTIVATE: active, falling (bit3 clear), Y one below the bottom.
  {
    const o = makeEntry(base, 0x01, 0x00, 0xf7); oracle(o);
    assert.equal(o.mem.read8(objAddr(0) + OBJ_Y), 0xf8, "falling object should reach the bottom");
    assert.equal(o.mem.read8(objAddr(0) + OBJ_ACTIVE), 0x00, "reaching the bottom should clear the active flag");
  }
  // (iii) SKIP: inactive record is untouched.
  {
    const o = makeEntry(base, 0x00, 0x08, 0x61); oracle(o);
    assert.equal(o.mem.read8(objAddr(0) + OBJ_Y), 0x61, "inactive record should be left untouched");
  }
  // (iv) non-terminal drifts (both directions), no land/deactivate.
  {
    const rise = makeEntry(base, 0x01, 0x08, 0x90); oracle(rise);
    assert.equal(rise.mem.read8(objAddr(0) + OBJ_Y), 0x8f, "rising drift is -1");
    assert.equal(rise.mem.read8(objAddr(0) + OBJ_STATE), 0x08, "no premature land");
    const fall = makeEntry(base, 0x01, 0x00, 0x40); oracle(fall);
    assert.equal(fall.mem.read8(objAddr(0) + OBJ_Y), 0x41, "falling drift is +1");
    assert.equal(fall.mem.read8(objAddr(0) + OBJ_ACTIVE), 0x01, "no premature deactivate");
  }

  // And loc_2797 reproduces each of those exact cases (RAM + live-out).
  for (const [a, s, y] of [[0x01, 0x08, 0x61], [0x01, 0x00, 0xf7], [0x00, 0x08, 0x61], [0x01, 0x08, 0x90], [0x01, 0x00, 0x40]]) {
    const { ram, oracleDe, candRet } = runPair(base, a, s, y, loc_2797);
    assert.equal(ram, null, `landmark ${hx(a)}/${hx(s)}/${hx(y)}: ${ram && `RAM@0x${(ram.addr ?? 0).toString(16)}`}`);
    assert.equal(candRet, oracleDe, "landmark live-out");
  }
  console.log("  LANDMARKS: land, deactivate, skip, and both non-terminal drifts are all exercised and matched");
});

// -- 3. EQUAL (all six records) -----------------------------------------------

// Load all six records with distinct states/Y so the whole loop is exercised: two at a
// terminal (a land at index 0, a deactivate at index 1), non-terminal drifts, an
// inactive skip, and a noisy state byte — at different indices to pin stride + offsets.
const ALL_SIX = [
  { active: 0x01, state: 0x08, y: 0x61 }, // 0: rising -> LAND
  { active: 0x01, state: 0x00, y: 0xf7 }, // 1: falling -> DEACTIVATE
  { active: 0x01, state: 0x08, y: 0x90 }, // 2: rising drift
  { active: 0x01, state: 0x00, y: 0x40 }, // 3: falling drift
  { active: 0x00, state: 0x08, y: 0x70 }, // 4: inactive -> skip
  { active: 0x01, state: 0xff, y: 0x00 }, // 5: bit3 set (noisy) rising, Y wraps 0x00 -> 0xff, no land
];

function makeAllSix(base, layout) {
  const e = base.clone();
  for (let i = 0; i < RECORD_COUNT; i++) {
    const obj = objAddr(i);
    const rec = layout[i];
    e.mem.write8(obj + OBJ_ACTIVE, rec.active);
    e.mem.write8(obj + OBJ_STATE, rec.state);
    e.mem.write8(obj + OBJ_X, 0x00);
    e.mem.write8(obj + OBJ_Y, rec.y);
  }
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

function runAllSix(base, layout, candidate) {
  const a = makeAllSix(base, layout);
  const b = makeAllSix(base, layout);
  oracle(a);
  const ret = candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram, oracleDe: a.regs.de, candRet: ret };
}

test("EQUAL (all six): loc_2797 == oracle when all six records are exercised at once", () => {
  const base = new Machine(ROM).clone();
  const { ram, oracleDe, candRet } = runAllSix(base, ALL_SIX, loc_2797);
  assert.equal(ram, null, ram && `RAM diverges at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`);
  assert.equal(candRet, oracleDe, "stride live-out mismatch on the all-six entry");
  assert.equal(candRet, EXPECTED_STRIDE, "stride live-out should be 0x10");

  // Spot-check that records at NON-zero indices actually transitioned (loop coverage).
  const after = makeAllSix(base, ALL_SIX); oracle(after);
  assert.equal(after.mem.read8(objAddr(1) + OBJ_ACTIVE), 0x00, "record 1 (index != 0) should have deactivated");
  assert.equal(after.mem.read8(objAddr(2) + OBJ_Y), 0x8f, "record 2 should have drifted up");
  assert.equal(after.mem.read8(objAddr(5) + OBJ_Y), 0xff, "record 5 Y should have wrapped 0x00 -> 0xff");
  console.log("  EQUAL/all-six: whole-loop pass over six records identical to the oracle (RAM + stride)");
});

// -- 4. TEETH -----------------------------------------------------------------

/** (a) tests bit1 of the active byte instead of bit0. */
function brokenActiveMask(m) {
  const { mem } = m;
  for (let i = 0; i < RECORD_COUNT; i++) {
    const obj = objAddr(i);
    if ((mem.read8(obj + OBJ_ACTIVE) & 0x02) === 0) continue; // BUG: bit1
    if ((mem.read8(obj + OBJ_STATE) & 0x08) !== 0) {
      const y = mem.read8(obj + OBJ_Y) - 1; mem.write8(obj + OBJ_Y, y);
      if (y === 96) { mem.write8(obj + OBJ_X, 119); mem.write8(obj + OBJ_STATE, 0x04); }
    } else {
      const y = mem.read8(obj + OBJ_Y) + 1; mem.write8(obj + OBJ_Y, y);
      if (y === 248) mem.write8(obj + OBJ_ACTIVE, 0x00);
    }
  }
  return STRIDE;
}

/** (b) tests bit2 of the state byte instead of bit3. */
function brokenStateMask(m) {
  const { mem } = m;
  for (let i = 0; i < RECORD_COUNT; i++) {
    const obj = objAddr(i);
    if ((mem.read8(obj + OBJ_ACTIVE) & 0x01) === 0) continue;
    if ((mem.read8(obj + OBJ_STATE) & 0x04) !== 0) { // BUG: bit2
      const y = mem.read8(obj + OBJ_Y) - 1; mem.write8(obj + OBJ_Y, y);
      if (y === 96) { mem.write8(obj + OBJ_X, 119); mem.write8(obj + OBJ_STATE, 0x04); }
    } else {
      const y = mem.read8(obj + OBJ_Y) + 1; mem.write8(obj + OBJ_Y, y);
      if (y === 248) mem.write8(obj + OBJ_ACTIVE, 0x00);
    }
  }
  return STRIDE;
}

/** (c) lands one pixel too early (compares 0x61 instead of 0x60). */
function brokenLandThreshold(m) {
  const { mem } = m;
  for (let i = 0; i < RECORD_COUNT; i++) {
    const obj = objAddr(i);
    if ((mem.read8(obj + OBJ_ACTIVE) & 0x01) === 0) continue;
    if ((mem.read8(obj + OBJ_STATE) & 0x08) !== 0) {
      const y = mem.read8(obj + OBJ_Y) - 1; mem.write8(obj + OBJ_Y, y);
      if (y === 97) { mem.write8(obj + OBJ_X, 119); mem.write8(obj + OBJ_STATE, 0x04); } // BUG: 0x61
    } else {
      const y = mem.read8(obj + OBJ_Y) + 1; mem.write8(obj + OBJ_Y, y);
      if (y === 248) mem.write8(obj + OBJ_ACTIVE, 0x00);
    }
  }
  return STRIDE;
}

/** (d) drops the deactivate on the falling limit. */
function brokenNoDeactivate(m) {
  const { mem } = m;
  for (let i = 0; i < RECORD_COUNT; i++) {
    const obj = objAddr(i);
    if ((mem.read8(obj + OBJ_ACTIVE) & 0x01) === 0) continue;
    if ((mem.read8(obj + OBJ_STATE) & 0x08) !== 0) {
      const y = mem.read8(obj + OBJ_Y) - 1; mem.write8(obj + OBJ_Y, y);
      if (y === 96) { mem.write8(obj + OBJ_X, 119); mem.write8(obj + OBJ_STATE, 0x04); }
    } else {
      const y = mem.read8(obj + OBJ_Y) + 1; mem.write8(obj + OBJ_Y, y);
      // BUG: never clears OBJ_ACTIVE
    }
  }
  return STRIDE;
}

/** (e) walks only five records instead of six. */
function brokenShortLoop(m) {
  const { mem } = m;
  for (let i = 0; i < RECORD_COUNT - 1; i++) { // BUG: five
    const obj = objAddr(i);
    if ((mem.read8(obj + OBJ_ACTIVE) & 0x01) === 0) continue;
    if ((mem.read8(obj + OBJ_STATE) & 0x08) !== 0) {
      const y = mem.read8(obj + OBJ_Y) - 1; mem.write8(obj + OBJ_Y, y);
      if (y === 96) { mem.write8(obj + OBJ_X, 119); mem.write8(obj + OBJ_STATE, 0x04); }
    } else {
      const y = mem.read8(obj + OBJ_Y) + 1; mem.write8(obj + OBJ_Y, y);
      if (y === 248) mem.write8(obj + OBJ_ACTIVE, 0x00);
    }
  }
  return STRIDE;
}

/** (f) returns the wrong stride (a correct-RAM twin with a broken live-out). */
function brokenLiveOut(m) {
  loc_2797(m);
  return 0x08; // BUG: not the stride the oracle leaves
}

test("TEETH: the sweep catches the wrong active mask, wrong state mask, early land, and dropped deactivate", () => {
  const base = new Machine(ROM).clone();

  const mA = fullSweep(base, brokenActiveMask).mismatch;
  assert.notEqual(mA, null, "wrong-active-mask twin escaped the sweep — the gate is worthless");

  const mS = fullSweep(base, brokenStateMask).mismatch;
  assert.notEqual(mS, null, "wrong-state-mask twin escaped the sweep — the gate is worthless");

  const mT = fullSweep(base, brokenLandThreshold).mismatch;
  assert.notEqual(mT, null, "early-land twin escaped the sweep — the gate is worthless");
  assert.equal(mT.kind, "ram", "early-land twin should be caught as a RAM diff");
  assert.equal(mT.ram.addr, objAddr(0) + OBJ_X, "early-land twin should diverge on OBJ_X");

  const mD = fullSweep(base, brokenNoDeactivate).mismatch;
  assert.notEqual(mD, null, "no-deactivate twin escaped the sweep — the gate is worthless");
  assert.equal(mD.ram.addr, objAddr(0) + OBJ_ACTIVE, "no-deactivate twin should diverge on OBJ_ACTIVE");

  console.log(
    `  TEETH/sweep: active-mask (${describeMismatch(mA)}); state-mask (${describeMismatch(mS)}); ` +
      `early-land (${describeMismatch(mT)}); no-deactivate (${describeMismatch(mD)})`,
  );
});

test("TEETH: the all-six entry catches a short loop, and the return check catches a wrong live-out", () => {
  const base = new Machine(ROM).clone();

  const short = runAllSix(base, ALL_SIX, brokenShortLoop);
  assert.notEqual(short.ram, null, "short-loop twin escaped — the all-six entry does not cover the last record");
  assert.equal(short.ram.addr, objAddr(5) + OBJ_Y, "short-loop twin should diverge on the sixth record's OBJ_Y");

  const live = runAllSix(base, ALL_SIX, brokenLiveOut);
  assert.equal(live.ram, null, "the live-out twin should be RAM-identical (only its return is broken)");
  assert.notEqual(live.candRet, live.oracleDe, "wrong-live-out twin escaped — the return check is worthless");

  console.log(
    `  TEETH/loop+liveout: short-loop caught at 0x${short.ram.addr.toString(16)}; ` +
      `wrong return ${hx(live.candRet)} != oracle DE ${hx(live.oracleDe)} caught`,
  );
});
