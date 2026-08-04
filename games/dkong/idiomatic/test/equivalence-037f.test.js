// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for rampDifficulty (ROM 0x037F) — the difficulty rate-divider.
 *
 * sub_037f is a LEAF whose entire memory-observable behaviour is a function of THREE
 * bytes — DIFFICULTY_PRESCALER (0x6384), DIFFICULTY_CLOCK (0x6381), LEVEL (0x6229) —
 * and it writes only those two counters plus DIFFICULTY (0x6380). It returns nothing a
 * caller consumes: its two early returns just mean "skip this frame's work." Everything
 * else the oracle touches (residual registers/flags, the SP/PC churn of its `ret`s)
 * never reaches RAM, so the contract is memory-only. That makes an EXHAUSTIVE gate
 * available, because the effect factorises cleanly into three disjoint paths and each
 * path's output depends only on the variables its dedicated sweep varies:
 *
 *   PATH A — outer divider skips (prescaler != 0): steps the prescaler and returns; the
 *            written byte depends ONLY on the prescaler. Swept over all 256 prescaler
 *            values (OUTER sweep).
 *   PATH B — inner divider skips (prescaler == 0, clock & 7 != 0): steps prescaler and
 *            clock and returns; depends ONLY on the clock. Covered by the INNER sweep,
 *            which runs prescaler == 0 over all 256 clock values.
 *   PATH C — recompute (prescaler == 0, clock & 7 == 0): steps both counters AND writes
 *            DIFFICULTY = min((LEVEL + (clock >> 3)) & 0xff, 5). Depends on the clock beat
 *            (one of 32 multiples of 8, giving addend 0..31) and the level. Swept over the
 *            COMPLETE grid of all 32 beats × all 256 levels (RECOMPUTE sweep).
 *
 * Together the three sweeps cover the full (prescaler, clock, level) input space by that
 * factorisation, so this is a proof, not a sample.
 *
 *   1. EQUAL (exhaustive) — rampDifficulty == oracle on RAM (firstStateDiff over the whole
 *      dump, which neither side writes outside those three cells) across all three sweeps.
 *
 *   2. TEETH (exhaustive) — three deliberately-broken twins, one per surface, each of which
 *      the same sweeps MUST catch:
 *        (a) no-wrap clamp — drops the byte-width wrap on the level+addend sum, so it clamps
 *            a wrapped-low sum to 5 where the oracle keeps it; caught by the RECOMPUTE sweep
 *            via the DIFFICULTY byte (justifies the u8 in the routine).
 *        (b) inverted outer gate — proceeds when the prescaler is nonzero and skips when 0;
 *            caught wherever the recompute should have run.
 *        (c) wrong inner mask — recomputes on every 4th step instead of every 8th; caught
 *            on the clock beats where the two masks disagree.
 *
 *   3. REALISM (captured dispatches) — hook 0x037F in a real attract run (the main loop
 *      calls it once per serviced frame), clone the machine at each true dispatch, and
 *      confirm rampDifficulty reproduces the oracle's RAM on every real state the game
 *      actually produces.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-037f.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_037f as oracle } from "../../translated/loc_037f.js";
import { rampDifficulty } from "../rampDifficulty.js";
import { DIFFICULTY_PRESCALER, DIFFICULTY_CLOCK, LEVEL, DIFFICULTY } from "../names.js";
import { u8 } from "../../../../core/int.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x037f;
// The oracle's `ret`s pop the stack; point SP at work RAM so those pops read valid bytes
// (never I/O). The oracle writes no RAM through the stack (a leaf: only pops), so this
// choice never affects the compared memory — it only keeps the oracle well-defined.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * A synthetic entry: a clone of `base` with the three input cells set and a safe stack.
 * Frame machinery is neutralised (clone() already sets nextNmi/nextBoundary = Infinity;
 * re-asserted here for clarity) so the oracle's `m.step` cannot fire an NMI or push a
 * frame while running in isolation.
 */
function makeEntry(base, prescaler, clock, level) {
  const e = base.clone();
  e.mem.write8(DIFFICULTY_PRESCALER, prescaler);
  e.mem.write8(DIFFICULTY_CLOCK, clock);
  e.mem.write8(LEVEL, level);
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
function runPair(base, prescaler, clock, level, candidate) {
  const a = makeEntry(base, prescaler, clock, level); // oracle
  const b = makeEntry(base, prescaler, clock, level); // candidate
  oracle(a);
  candidate(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return { ram };
}

/**
 * The three disjoint path sweeps, run in sequence. Returns the first mismatch (or null)
 * and the total combos compared. By the factorisation in the file header these three
 * sweeps together cover the whole (prescaler, clock, level) input space.
 */
function fullSweep(base, candidate) {
  let count = 0;

  // PATH A — outer divider over all 256 prescaler values (clock/level fixed; when the
  // prescaler is 0 this also runs one recompute at clock 0).
  for (let p = 0; p < 256; p++) {
    const { ram } = runPair(base, p, 0, 3, candidate);
    count++;
    if (ram) return { mismatch: { p, clock: 0, level: 3, ram }, count };
  }

  // PATH B + the clock's own coverage — inner divider over all 256 clock values with the
  // outer gate open (prescaler 0). Covers every skip (clock & 7 != 0), every recompute
  // beat at this level, and the clock's 255 -> 0 wrap.
  for (let c = 0; c < 256; c++) {
    const { ram } = runPair(base, 0, c, 3, candidate);
    count++;
    if (ram) return { mismatch: { p: 0, clock: c, level: 3, ram }, count };
  }

  // PATH C — the full recompute grid: every clock beat (32 multiples of 8 → addend 0..31)
  // against every level 0..255. Exhaustive over the recompute's whole input space.
  for (let c = 0; c < 256; c += 8) {
    for (let l = 0; l < 256; l++) {
      const { ram } = runPair(base, 0, c, l, candidate);
      count++;
      if (ram) return { mismatch: { p: 0, clock: c, level: l, ram }, count };
    }
  }

  return { mismatch: null, count };
}

const describeMismatch = (mm) =>
  mm &&
  `at prescaler=${hx(mm.p)} clock=${hx(mm.clock)} level=${hx(mm.level)}: ` +
    `RAM diverges at 0x${(mm.ram.addr ?? 0).toString(16)} (${mm.ram.a}->${mm.ram.b})`;

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): rampDifficulty == oracle across all three path sweeps", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, rampDifficulty);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  // 256 outer + 256 inner + 32*256 recompute
  assert.equal(count, 256 + 256 + 32 * 256, "must have compared the full factored input space");
  console.log(`  EQUAL/exhaustive: ${count} (prescaler, clock, level) combos — RAM identical to the oracle`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/**
 * BUG (a): drops the byte-width wrap on the level+addend sum. Where the sum wraps into
 * 0..4 (only reachable with an out-of-range level), the oracle KEEPS the wrapped small
 * value but this twin sees the un-wrapped big value and clamps it to 5 — a wrong
 * DIFFICULTY byte. Invisible on realistic levels; caught by the RECOMPUTE sweep.
 */
function brokenNoWrapClamp(m) {
  const { mem } = m;
  const prescaler = mem.read8(DIFFICULTY_PRESCALER);
  mem.write8(DIFFICULTY_PRESCALER, prescaler + 1);
  if (prescaler !== 0) return;
  const clock = mem.read8(DIFFICULTY_CLOCK);
  mem.write8(DIFFICULTY_CLOCK, clock + 1);
  if ((clock & 7) !== 0) return;
  const ramp = mem.read8(LEVEL) + (clock >> 3); // BUG: no u8() — the wrap is dropped
  mem.write8(DIFFICULTY, ramp < 5 ? ramp : 5);
}

/** BUG (b): inverts the outer gate — proceeds on nonzero, skips on zero. The recompute
 *  never runs when it should (and runs when it should not). Caught wherever it matters. */
function brokenOuterGateInverted(m) {
  const { mem } = m;
  const prescaler = mem.read8(DIFFICULTY_PRESCALER);
  mem.write8(DIFFICULTY_PRESCALER, prescaler + 1);
  if (prescaler === 0) return; // BUG: should be `prescaler !== 0`
  const clock = mem.read8(DIFFICULTY_CLOCK);
  mem.write8(DIFFICULTY_CLOCK, clock + 1);
  if ((clock & 7) !== 0) return;
  const ramp = u8(mem.read8(LEVEL) + (clock >> 3));
  mem.write8(DIFFICULTY, ramp < 5 ? ramp : 5);
}

/** BUG (c): tests the wrong inner mask — recomputes every 4th step instead of every 8th,
 *  so it writes DIFFICULTY on clock beats the oracle skips. Caught by the clock sweep. */
function brokenInnerMask(m) {
  const { mem } = m;
  const prescaler = mem.read8(DIFFICULTY_PRESCALER);
  mem.write8(DIFFICULTY_PRESCALER, prescaler + 1);
  if (prescaler !== 0) return;
  const clock = mem.read8(DIFFICULTY_CLOCK);
  mem.write8(DIFFICULTY_CLOCK, clock + 1);
  if ((clock & 3) !== 0) return; // BUG: should be `(clock & 7)`
  const ramp = u8(mem.read8(LEVEL) + (clock >> 3));
  mem.write8(DIFFICULTY, ramp < 5 ? ramp : 5);
}

test("TEETH (exhaustive): the no-wrap-clamp twin is CAUGHT (DIFFICULTY byte diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenNoWrapClamp);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a dropped level+addend wrap — the RAM check is worthless");
  assert.equal(mismatch.ram.addr, DIFFICULTY, "the no-wrap twin must diverge on the DIFFICULTY byte");
  console.log(`  TEETH/clamp: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the inverted-outer-gate twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenOuterGateInverted);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch an inverted outer divider — worthless");
  console.log(`  TEETH/outer: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the wrong-inner-mask twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenInnerMask);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong inner-divider mask — worthless");
  console.log(`  TEETH/inner: caught — ${describeMismatch(mismatch)}`);
});

// -- 3. REALISM (captured dispatches) -----------------------------------------

/**
 * Hook 0x037F in a real attract run and clone the machine at up to K real dispatches.
 * The main loop calls it once per serviced frame, so attract dispatches it every frame.
 * The wrapper clones the entry state, then runs the oracle so the host game proceeds
 * undisturbed to a clean stop.
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

test("REALISM: real captured 0x037F dispatches — rampDifficulty matches oracle RAM", () => {
  const caps = captureDispatches(200, 1500);
  assert.ok(caps.length >= 1, "expected at least one real 0x037F dispatch during attract");

  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    const pre = a.mem.read8(DIFFICULTY_PRESCALER);
    const clk = a.mem.read8(DIFFICULTY_CLOCK);
    oracle(a);
    rampDifficulty(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      ram,
      null,
      ram &&
        `RAM diverges on real dispatch (prescaler=${hx(pre)} clock=${hx(clk)}) ` +
          `at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
    );
  }
  console.log(`  REALISM: ${caps.length} real 0x037F dispatches — RAM == oracle`);
});
