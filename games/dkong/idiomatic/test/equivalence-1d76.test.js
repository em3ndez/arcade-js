// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_1d76 (ROM 0x1D76) — the "sub-step timer still running"
 * branch of the walk/climb animation stepper (entry_1d03).
 *
 * loc_1d76's entire memory-observable behaviour is a total function of four work-RAM
 * bytes — the flag 0x621A, MARIO_CLIMB_LIMIT_B (0x621C), MARIO_Y (0x6205), and the
 * timer MARIO_MOVE_STEP_TIMER (0x620F) — and its outputs are just two bytes: it may
 * mirror the flag into 0x6219 and it may decrement the timer. It reads no live-in
 * register and calls only the shared decrement tail (tickMoveStepTimer / entry_1d8a).
 * The oracle's `ret`/fall-through is the return mechanism the JS return replaces, so
 * SP/PC are not in the contract, and the residual A/F are dead ABI (overwritten by the
 * stepper's caller cascade). That leaves a memory-only contract — compared here on RAM
 * (whole dump; neither side writes the STACK_SCRATCH region) via firstStateDiff:
 *
 *   1. EQUAL (exhaustive grid, flag == 0) — the arm attract exercises: over the FULL
 *      256×256 (limit, Y) grid the routine must ignore limit/Y entirely, never write
 *      0x6219, and always decrement the timer. RAM identical to the oracle on all 65,536.
 *
 *   2. EQUAL (exhaustive grid, flag != 0) — the cold arm: over the same 256×256 grid the
 *      routine must mirror the flag into 0x6219 and decrement the timer IFF (limit−0x13)
 *      < Y (8-bit sub wrap included). This exhaustively pins the compare decision.
 *
 *   3. EQUAL (flag breadth) — all 256 flag bytes over curated (limit, Y) edges: proves
 *      the flag matters only as zero/non-zero, and that the non-zero mirror stores the
 *      flag byte EXACTLY.
 *
 *   4. EQUAL (timer breadth) — all 256 timer values on a decrement path (both flag arms),
 *      covering the tail's 0x00 → 0xFF wrap.
 *
 *   5. TEETH — two deliberately-broken twins the exhaustive non-zero grid MUST catch:
 *        (a) reversed compare — decrements when it should hold and vice versa.
 *        (b) no mirror — omits the 0x6219 store.
 *
 *   6. REALISM (captured dispatches) — hook 0x1d76 in a real attract run (fires ~46× on
 *      25m, all flag == 0) and confirm loc_1d76 reproduces the oracle's RAM on every
 *      real state.
 *
 *   7. CRAFTED (cold non-zero arm on real states) — take real captured states, poke the
 *      flag non-zero and set limit/Y to force BOTH sub-branches (hold and decrement),
 *      identically on both sides — the doc-06 crafted entry for an arm attract never hits.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-1d76.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1d76 as oracle } from "../../translated/loc_1d76.js";
import { loc_1d76 } from "../loc_1d76.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1d76;
const FLAG = 0x621a; // gate flag (unnamed in ram.js)
const MIRROR = 0x6219; // flag mirror target (unnamed in ram.js)
const LIMIT = 0x621c; // MARIO_CLIMB_LIMIT_B
const MARIO_Y = 0x6205; // MARIO_Y
const TIMER = 0x620f; // MARIO_MOVE_STEP_TIMER
// The oracle's ret/tail pops the stack; point SP at work RAM so the pop reads valid
// bytes (never I/O). ret only READS the stack, so it does not touch the compared RAM.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * Run the oracle and a candidate on two FRESH clones of `entry` and diff the
 * memory-equivalence contract (RAM whole dump — neither side writes STACK_SCRATCH). A
 * fresh clone per side because the routine WRITES memory (docs/06: only a pure read-only
 * leaf may reuse a clone).
 *
 * @returns {object|null}  the first RAM diff, or null when identical.
 */
function runPair(entry, candidate) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/**
 * A synthetic entry: `base` with the four input bytes set and a safe stack. 0x6219 is
 * seeded to a sentinel distinct from the flag so a missed mirror store is detectable.
 */
function makeEntry(base, { flag, limit, y, timer }) {
  const e = base.clone();
  e.mem.write8(FLAG, flag);
  e.mem.write8(LIMIT, limit);
  e.mem.write8(MARIO_Y, y);
  e.mem.write8(TIMER, timer);
  e.mem.write8(MIRROR, 0x00); // sentinel: oracle overwrites it only on the non-zero arm
  e.regs.sp = SAFE_SP;
  return e;
}

/**
 * Sweep a candidate vs the oracle over the full 256×256 (limit, Y) grid at a fixed
 * flag/timer. Returns the first RAM mismatch (or null) and the count compared.
 */
function gridSweep(base, candidate, flag, timer) {
  let count = 0;
  for (let limit = 0; limit < 256; limit++) {
    for (let y = 0; y < 256; y++) {
      const ram = runPair(makeEntry(base, { flag, limit, y, timer }), candidate);
      count++;
      if (ram) return { mismatch: { flag, limit, y, timer, ram }, count };
    }
  }
  return { mismatch: null, count };
}

const fmtDiff = (m) =>
  m &&
  `flag=${hx(m.flag)} limit=${hx(m.limit)} y=${hx(m.y)} timer=${hx(m.timer)}: RAM diverges at ` +
    `0x${(m.ram.addr ?? 0).toString(16)} (oracle=${m.ram.a} cand=${m.ram.b})`;

// -- 1. EQUAL (exhaustive grid, flag == 0) ------------------------------------

test("EQUAL (exhaustive grid, flag==0): decrement arm ignores limit/Y over all 65,536", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = gridSweep(base, loc_1d76, 0x00, 0x04);
  assert.equal(mismatch, null, fmtDiff(mismatch));
  assert.equal(count, 256 * 256, "must have compared the full (limit,Y) grid");
  console.log(`  EQUAL/grid flag==0: ${count} (limit,Y) — RAM identical (always decrements, never touches 0x6219)`);
});

// -- 2. EQUAL (exhaustive grid, flag != 0) ------------------------------------

test("EQUAL (exhaustive grid, flag!=0): compare + mirror pinned over all 65,536 (limit,Y)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = gridSweep(base, loc_1d76, 0x01, 0x04);
  assert.equal(mismatch, null, fmtDiff(mismatch));
  assert.equal(count, 256 * 256, "must have compared the full (limit,Y) grid");
  console.log(`  EQUAL/grid flag!=0: ${count} (limit,Y) — RAM identical (mirror + (limit-0x13)<Y decrement)`);
});

// -- 3. EQUAL (flag breadth) --------------------------------------------------

test("EQUAL (flag breadth): all 256 flag bytes match the oracle on curated (limit,Y) edges", () => {
  const base = new Machine(ROM).clone();
  // (limit,Y) edges: a decrement case (limit-0x13 < Y), a hold case (>= Y), and the
  // sub-0x13 wrap edge (limit < 0x13 so limit-0x13 wraps high).
  const CASES = [
    { limit: 0x20, y: 0xf0 }, // 0x0D < 0xF0 -> decrement
    { limit: 0xf0, y: 0x10 }, // 0xDD >= 0x10 -> hold
    { limit: 0x00, y: 0x80 }, // wrap: (0-0x13)&0xff = 0xED >= 0x80 -> hold
    { limit: 0x13, y: 0x01 }, // 0x00 >= 0x01? no -> decrement
  ];
  let count = 0;
  let mismatch = null;
  for (let flag = 0; flag < 256 && !mismatch; flag++) {
    for (const c of CASES) {
      const ram = runPair(makeEntry(base, { flag, limit: c.limit, y: c.y, timer: 0x04 }), loc_1d76);
      count++;
      if (ram) {
        mismatch = { flag, limit: c.limit, y: c.y, timer: 0x04, ram };
        break;
      }
    }
  }
  assert.equal(mismatch, null, fmtDiff(mismatch));
  console.log(`  EQUAL/flag-breadth: ${count} combos over all 256 flags — RAM identical (mirror stores flag exactly)`);
});

// -- 4. EQUAL (timer breadth) -------------------------------------------------

test("EQUAL (timer breadth): all 256 timer values on a decrement path (incl. 0x00->0xFF wrap)", () => {
  const base = new Machine(ROM).clone();
  let count = 0;
  let mismatch = null;
  for (let timer = 0; timer < 256 && !mismatch; timer++) {
    // flag==0 decrement path AND flag!=0 decrement path (limit-0x13 < Y).
    for (const entry of [
      { flag: 0x00, limit: 0x00, y: 0x00, timer },
      { flag: 0x01, limit: 0x20, y: 0xf0, timer },
    ]) {
      const ram = runPair(makeEntry(base, entry), loc_1d76);
      count++;
      if (ram) {
        mismatch = { ...entry, ram };
        break;
      }
    }
  }
  assert.equal(mismatch, null, fmtDiff(mismatch));
  console.log(`  EQUAL/timer-breadth: ${count} timer values — RAM identical (tail wrap covered)`);
});

// -- 5. TEETH -----------------------------------------------------------------

/** BUG: reverses the compare — decrements when it should hold and vice versa. */
function brokenReversedCompare(m) {
  const { mem } = m;
  const flag = mem.read8(FLAG);
  if (flag === 0) {
    mem.write8(TIMER, (mem.read8(TIMER) - 1) & 0xff);
    return;
  }
  mem.write8(MIRROR, flag);
  const t = (mem.read8(LIMIT) - 0x13) & 0xff;
  if (t < mem.read8(MARIO_Y)) return; // BUG: should be `>=`
  mem.write8(TIMER, (mem.read8(TIMER) - 1) & 0xff);
}

/** BUG: omits the 0x6219 mirror store. */
function brokenNoMirror(m) {
  const { mem } = m;
  const flag = mem.read8(FLAG);
  if (flag === 0) {
    mem.write8(TIMER, (mem.read8(TIMER) - 1) & 0xff);
    return;
  }
  // BUG: no `mem.write8(0x6219, flag)`
  const t = (mem.read8(LIMIT) - 0x13) & 0xff;
  if (t >= mem.read8(MARIO_Y)) return;
  mem.write8(TIMER, (mem.read8(TIMER) - 1) & 0xff);
}

test("TEETH: the reversed-compare twin is CAUGHT by the non-zero grid", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = gridSweep(base, brokenReversedCompare, 0x01, 0x04);
  assert.notEqual(mismatch, null, "the grid FAILED to catch a reversed compare — worthless");
  assert.equal(mismatch.ram.addr, TIMER, "the caught diff must be at the wrongly (non-)decremented timer 0x620F");
  console.log(`  TEETH/reversed: caught at ${fmtDiff(mismatch)}`);
});

test("TEETH: the no-mirror twin is CAUGHT by the non-zero grid", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = gridSweep(base, brokenNoMirror, 0x01, 0x04);
  assert.notEqual(mismatch, null, "the grid FAILED to catch a missing mirror store — worthless");
  assert.equal(mismatch.ram.addr, MIRROR, "the caught diff must be at the un-mirrored flag byte 0x6219");
  console.log(`  TEETH/no-mirror: caught at ${fmtDiff(mismatch)}`);
});

// -- 6. REALISM (captured dispatches) -----------------------------------------

/**
 * Hook 0x1d76 in a real attract run and clone the machine at up to K real dispatches.
 * The wrapper clones the entry state, then runs the oracle so the host game proceeds
 * undisturbed. Attract plays 25m and Mario walks/climbs, so entry_1d03 routes here ~46×
 * with real timer/limit/Y — all with the flag (0x621A) == 0.
 */
function captureDispatches(K, maxFrames) {
  const caps = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snapshot });
  host.runFrames(maxFrames);
  return caps;
}

test("REALISM: real captured walk/climb dispatches (flag==0) — loc_1d76 matches oracle RAM", () => {
  const caps = captureDispatches(128, 1400);
  assert.ok(caps.length >= 1, "expected at least one real 0x1d76 dispatch during 25m attract");
  for (const cap of caps) {
    assert.equal(cap.mem.read8(FLAG), 0, "attract dispatches are expected to hit only the flag==0 arm");
    const ram = runPair(cap, loc_1d76);
    assert.equal(ram, null, ram && `RAM diverges on real dispatch at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`);
  }
  console.log(`  REALISM: ${caps.length} real dispatches (flag==0) — RAM == oracle`);
});

// -- 7. CRAFTED (cold non-zero arm on real states) ----------------------------

test("CRAFTED: real states poked to the cold flag!=0 arm (both sub-branches) match the oracle", () => {
  const caps = captureDispatches(16, 1400);
  assert.ok(caps.length >= 1, "expected at least one real dispatch to craft from");
  let count = 0;
  for (const cap of caps) {
    // Poke the ONE variable that forces the unhit path (flag != 0), plus limit/Y to
    // force each sub-branch — identically on both sides via runPair's fresh clones.
    for (const poke of [
      { flag: 0x01, limit: 0x20, y: 0xf0 }, // decrement: (0x20-0x13)=0x0D < 0xF0
      { flag: 0x80, limit: 0xf0, y: 0x10 }, // hold: 0xDD >= 0x10
      { flag: 0xff, limit: 0x13, y: 0x00 }, // boundary: 0x00 >= 0x00 -> hold
    ]) {
      const e = cap.clone();
      e.mem.write8(FLAG, poke.flag);
      e.mem.write8(LIMIT, poke.limit);
      e.mem.write8(MARIO_Y, poke.y);
      const ram = runPair(e, loc_1d76);
      count++;
      assert.equal(
        ram,
        null,
        ram && `crafted flag=${hx(poke.flag)} limit=${hx(poke.limit)} y=${hx(poke.y)} diverges at ` +
          `0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
      );
    }
  }
  console.log(`  CRAFTED: ${count} cold-arm entries on real states — RAM == oracle`);
});
