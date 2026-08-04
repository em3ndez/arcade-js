// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for beginMarioFall (ROM 0x1F46) — the "start falling" player-state
 * reset that consumes MARIO_START_FALL.
 *
 * sub_1f46 is a LEAF, and its entire memory-observable behaviour factors into exactly
 * TWO inputs:
 *
 *   - MARIO_START_FALL (0x6221) — the trigger. Zero returns at once with NO writes;
 *     any nonzero value runs the reset, which also clears the trigger. The specific
 *     nonzero value is irrelevant (it is overwritten with 0 either way), so every
 *     nonzero trigger must produce the identical reset.
 *   - MARIO_Y (0x6205) — Mario's current height. The reset snapshots it into
 *     MARIO_AIR_START_Y (0x620E); it is the ONLY input the reset copies out. Everything
 *     else the reset writes is a fixed constant (eight cells to 0, two cells to 1).
 *
 * It calls nothing and returns nothing a caller consumes (its two `ret`s only pop the
 * caller's address off the stack — the popped bytes never reach RAM), so the contract is
 * memory-only and an EXHAUSTIVE gate is available by that factorisation:
 *
 *   TRIGGER sweep — vary the trigger over all 256 bytes with the height fixed. Covers the
 *     early-out (trigger 0) and proves every nonzero trigger runs the same reset.
 *   HEIGHT sweep — vary the height over all 256 bytes with the trigger fixed nonzero.
 *     Covers the take-off-Y snapshot for every height.
 *   CROSS grid — a spread of (trigger, height) pairs, to foreclose any pathological
 *     cross-term the two 1-D sweeps could individually miss.
 *
 * Each sweep runs on a CLEAN base and on a sentinel-NOISED base: the eight cleared cells
 * pre-set to 0xFF (a dropped clear stays 0xFF), the two set cells pre-set to 0x00 (a
 * dropped set stays 0x00), the take-off-Y snapshot cell pre-set to 0xFF (a dropped
 * snapshot stays 0xFF), and a spread of unrelated work RAM to 0xFF (a collateral write
 * surfaces). Without the noise base a fresh machine's zeros would hide a dropped clear.
 *
 *   1. EQUAL (exhaustive) — beginMarioFall == oracle on RAM (firstStateDiff over the
 *      whole dump; neither side writes outside the eleven reset cells) across every combo
 *      of both sweeps + the cross grid, on both bases.
 *
 *   2. TEETH (exhaustive) — three deliberately-broken twins the same sweeps MUST catch:
 *        (a) dropped airborne set — never marks Mario airborne; caught at MARIO_AIRBORNE
 *            (the state the movement machine reads to run the fall — the load-bearing bit).
 *        (b) dropped snapshot — never records the take-off Y; caught at MARIO_AIR_START_Y.
 *        (c) inverted trigger gate — resets on trigger 0 and skips when nonzero; caught
 *            on both the should-reset and should-skip states.
 *
 *   3. REALISM (captured dispatches) — the per-frame cascade calls 0x1F46 every pass, so
 *      attract dispatches it constantly (almost always the early-out) and reaches the
 *      reset exactly when the demo walks off a ledge. Hook it in a real attract run, keep
 *      every reset-path state plus a sample of early-outs, and confirm beginMarioFall
 *      reproduces the oracle's RAM on every real state the game actually produces.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-1f46.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1f46 as oracle } from "../../translated/loc_1f46.js";
import { beginMarioFall } from "../beginMarioFall.js";
import {
  MARIO_START_FALL,
  MARIO_X_FRAC,
  MARIO_Y_FRAC,
  MARIO_AIR_VX_HI,
  MARIO_AIR_VX_LO,
  MARIO_AIR_VY_HI,
  MARIO_AIR_VY_LO,
  MARIO_AIR_FRAMES,
  MARIO_AIRBORNE,
  MARIO_AIR_LANDCHECK,
  MARIO_Y,
  MARIO_AIR_START_Y,
} from "../names.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1f46;
// The oracle's `ret`s pop the stack; point SP at work RAM so those pops read valid bytes
// (never I/O). The oracle writes no RAM through the stack (a leaf: only pops), so this
// choice never affects the compared memory — it only keeps the oracle well-defined.
const SAFE_SP = 0x6bf8;

const Y_FIXED = 0x40;   // a height for the TRIGGER sweep; distinct from the 0xFF snapshot sentinel
const TRIG_ON = 0x01;   // a nonzero trigger for the HEIGHT sweep (runs the reset)

// The eight cells the reset clears to 0 (MARIO_START_FALL is one of them, but it is the
// swept trigger and is written last in makeEntry).
const CLEARED_CELLS = [
  MARIO_X_FRAC, MARIO_Y_FRAC, MARIO_START_FALL,
  MARIO_AIR_VX_HI, MARIO_AIR_VX_LO, MARIO_AIR_VY_HI, MARIO_AIR_VY_LO, MARIO_AIR_FRAMES,
];
// The two cells the reset sets to 1.
const SET_CELLS = [MARIO_AIRBORNE, MARIO_AIR_LANDCHECK];
// Unrelated work RAM the reset never touches (rejected/other-subsystem cells) — a
// collateral write would land on one of these and surface as a divergence.
const NEIGHBOUR_CELLS = [0x6201, 0x620d, 0x6223, 0x6226, 0x6100, 0x6400, 0x66a0];

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * A synthetic entry: a clone of `base` with the trigger and height set (and optional
 * sentinel noise on the reset's targets + surroundings) and a safe stack. Frame
 * machinery is neutralised (clone() already sets nextNmi/nextBoundary = Infinity;
 * re-asserted for clarity) so the oracle's `m.step` cannot fire an NMI or push a frame
 * while running in isolation.
 */
function makeEntry(base, trigger, y, noise) {
  const e = base.clone();
  if (noise) {
    for (const a of CLEARED_CELLS) e.mem.write8(a, 0xff);      // dropped clear -> stays 0xff
    for (const a of SET_CELLS) e.mem.write8(a, 0x00);          // dropped set   -> stays 0x00
    e.mem.write8(MARIO_AIR_START_Y, 0xff);                     // dropped snapshot -> stays 0xff
    for (const a of NEIGHBOUR_CELLS) e.mem.write8(a, 0xff);    // collateral write -> caught
  }
  e.mem.write8(MARIO_START_FALL, trigger); // trigger (also a cleared cell; written last)
  e.mem.write8(MARIO_Y, y);                // the snapshot source
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and the candidate on two FRESH, byte-identical entries and diff the
 * memory-equivalence contract (RAM over the whole dump). A fresh entry per side because
 * the routine WRITES memory — a reused machine would carry the previous run forward.
 *
 * @returns {{ram: object|null}}
 */
function runPair(base, trigger, y, noise, candidate) {
  const a = makeEntry(base, trigger, y, noise); // oracle
  const b = makeEntry(base, trigger, y, noise); // candidate
  oracle(a);
  candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram };
}

/**
 * The factored exhaustive sweep: TRIGGER (all 256, height fixed) + HEIGHT (all 256,
 * trigger fixed nonzero) + a CROSS grid, each on the clean and noised base. Together these
 * cover the whole (trigger, height) input space. Returns the first mismatch (or null) and
 * the total combos compared.
 */
function fullSweep(base, candidate) {
  let count = 0;
  const crossTrig = [TRIG_ON, 0x42, 0x80, 0xff];
  const crossY = [0x00, 0x01, 0x40, 0x80, 0xff];
  for (const noise of [false, true]) {
    // TRIGGER sweep — path select + every nonzero trigger is the same reset.
    for (let t = 0; t < 256; t++) {
      const { ram } = runPair(base, t, Y_FIXED, noise, candidate);
      count++;
      if (ram) return { mismatch: { t, y: Y_FIXED, noise, ram }, count };
    }
    // HEIGHT sweep — the take-off-Y snapshot for every height.
    for (let y = 0; y < 256; y++) {
      const { ram } = runPair(base, TRIG_ON, y, noise, candidate);
      count++;
      if (ram) return { mismatch: { t: TRIG_ON, y, noise, ram }, count };
    }
    // CROSS grid — forecloses a (trigger, height) cross-term the 1-D sweeps could miss.
    for (const t of crossTrig) for (const y of crossY) {
      const { ram } = runPair(base, t, y, noise, candidate);
      count++;
      if (ram) return { mismatch: { t, y, noise, ram }, count };
    }
  }
  return { mismatch: null, count };
}

// combos per base: 256 trigger + 256 height + 4*5 cross = 532; two bases.
const COMBOS = (256 + 256 + 4 * 5) * 2;

const describeMismatch = (mm) =>
  mm &&
  `at trigger=${hx(mm.t)} height=${hx(mm.y)} noise=${mm.noise}: RAM diverges at ` +
    `0x${(mm.ram.addr ?? 0).toString(16)} (${mm.ram.a}->${mm.ram.b})`;

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): beginMarioFall == oracle across the whole (trigger, height) space (clean + noise)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, beginMarioFall);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, COMBOS, "must have compared the full factored input space on both bases");
  console.log(`  EQUAL/exhaustive: ${count} (trigger, height) combos — RAM identical to the oracle`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/** BUG (a): never marks Mario airborne — drops the MARIO_AIRBORNE set. */
function brokenDroppedAirborne(m) {
  const { mem } = m;
  if (mem.read8(MARIO_START_FALL) === 0) return;
  mem.write8(MARIO_X_FRAC, 0);
  mem.write8(MARIO_Y_FRAC, 0);
  mem.write8(MARIO_START_FALL, 0);
  mem.write8(MARIO_AIR_VX_HI, 0);
  mem.write8(MARIO_AIR_VX_LO, 0);
  mem.write8(MARIO_AIR_VY_HI, 0);
  mem.write8(MARIO_AIR_VY_LO, 0);
  mem.write8(MARIO_AIR_FRAMES, 0);
  // BUG: MARIO_AIRBORNE never set
  mem.write8(MARIO_AIR_LANDCHECK, 1);
  mem.write8(MARIO_AIR_START_Y, mem.read8(MARIO_Y));
}

/** BUG (b): never records the take-off Y — drops the MARIO_AIR_START_Y snapshot. */
function brokenDroppedSnapshot(m) {
  const { mem } = m;
  if (mem.read8(MARIO_START_FALL) === 0) return;
  mem.write8(MARIO_X_FRAC, 0);
  mem.write8(MARIO_Y_FRAC, 0);
  mem.write8(MARIO_START_FALL, 0);
  mem.write8(MARIO_AIR_VX_HI, 0);
  mem.write8(MARIO_AIR_VX_LO, 0);
  mem.write8(MARIO_AIR_VY_HI, 0);
  mem.write8(MARIO_AIR_VY_LO, 0);
  mem.write8(MARIO_AIR_FRAMES, 0);
  mem.write8(MARIO_AIRBORNE, 1);
  mem.write8(MARIO_AIR_LANDCHECK, 1);
  // BUG: MARIO_AIR_START_Y never written
}

/** BUG (c): inverts the trigger gate — resets on 0, skips when nonzero. */
function brokenInvertedGate(m) {
  const { mem } = m;
  if (mem.read8(MARIO_START_FALL) !== 0) return; // BUG: should be `=== 0`
  mem.write8(MARIO_X_FRAC, 0);
  mem.write8(MARIO_Y_FRAC, 0);
  mem.write8(MARIO_START_FALL, 0);
  mem.write8(MARIO_AIR_VX_HI, 0);
  mem.write8(MARIO_AIR_VX_LO, 0);
  mem.write8(MARIO_AIR_VY_HI, 0);
  mem.write8(MARIO_AIR_VY_LO, 0);
  mem.write8(MARIO_AIR_FRAMES, 0);
  mem.write8(MARIO_AIRBORNE, 1);
  mem.write8(MARIO_AIR_LANDCHECK, 1);
  mem.write8(MARIO_AIR_START_Y, mem.read8(MARIO_Y));
}

test("TEETH (exhaustive): the dropped-airborne twin is CAUGHT at MARIO_AIRBORNE", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenDroppedAirborne);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a dropped airborne set — the RAM check is worthless");
  assert.equal(mismatch.ram.addr, MARIO_AIRBORNE, "the dropped-airborne twin must diverge on MARIO_AIRBORNE");
  console.log(`  TEETH/airborne: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the dropped-snapshot twin is CAUGHT at MARIO_AIR_START_Y", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenDroppedSnapshot);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a dropped take-off-Y snapshot — worthless");
  assert.equal(mismatch.ram.addr, MARIO_AIR_START_Y, "the dropped-snapshot twin must diverge on MARIO_AIR_START_Y");
  console.log(`  TEETH/snapshot: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the inverted-trigger-gate twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenInvertedGate);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch an inverted trigger gate — worthless");
  console.log(`  TEETH/gate: caught — ${describeMismatch(mismatch)}`);
});

// -- 3. REALISM (captured dispatches) -----------------------------------------

/**
 * Hook 0x1F46 in a real attract run. Keep EVERY reset-path state (trigger nonzero — rare,
 * the demo reaches it when it walks off a ledge) plus a bounded sample of early-out states
 * (trigger zero — the common case). The wrapper clones the entry, then runs the oracle so
 * the host game proceeds undisturbed.
 */
function captureDispatches(maxEarlyOut, maxFrames) {
  const caps = [];
  let earlyOuts = 0;
  const snapshot = new Map([[TARGET, (mm) => {
    if (mm.mem.read8(MARIO_START_FALL) !== 0) {
      caps.push(mm.clone());                 // always keep the reset arm
    } else if (earlyOuts < maxEarlyOut) {
      caps.push(mm.clone()); earlyOuts++;    // sample the early-out arm
    }
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snapshot });
  host.runFrames(maxFrames);
  return caps;
}

test("REALISM: real captured 0x1F46 dispatches — beginMarioFall matches oracle RAM", () => {
  const caps = captureDispatches(64, 4200);
  assert.ok(caps.length >= 1, "expected at least one real 0x1F46 dispatch during attract");

  let sawReset = 0, sawEarlyOut = 0;
  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    const trig = a.mem.read8(MARIO_START_FALL);
    const y = a.mem.read8(MARIO_Y);
    if (trig !== 0) sawReset++; else sawEarlyOut++;
    oracle(a);
    beginMarioFall(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      ram,
      null,
      ram &&
        `RAM diverges on real dispatch (trigger=${hx(trig)} height=${hx(y)}) ` +
          `at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
    );
  }
  console.log(`  REALISM: ${caps.length} real 0x1F46 dispatches — RAM == oracle (${sawReset} reset, ${sawEarlyOut} early-out)`);
});
