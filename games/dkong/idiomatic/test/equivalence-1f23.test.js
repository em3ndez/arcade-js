// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for animateEffectSpriteThenRearmEffect (ROM 0x1F23) — effect-sequence step 2, a two-stage rate divider
 * that steps the effect sprite's tile on most beats and, when the outer counter runs out, resets
 * the sequence and re-arms the parent effect state machine.
 *
 * animateEffectSpriteThenRearmEffect is a LEAF (no callees) and the sibling of flashEffectSpriteThenAdvanceSequence; it shares the two-stage divider but
 * differs in three ways this gate nails: the inner divider reloads to 12 (not 6), the ordinary beat
 * INCREMENTS the sprite code (not flips its low bit), and the final beat does NOT reload the outer
 * divider — instead it tears the sequence down. Its whole memory-observable behaviour is a function
 * of these cells, and it writes only these cells:
 *
 *   EFFECT_SEQ_INNER  (0x6346)  fast divider, ticked every dispatch, reloaded to 12 on a beat
 *   EFFECT_SEQ_OUTER  (0x6347)  slow divider, ticked on each beat (never reloaded here)
 *   EFFECT_SEQ_STATE  (0x6345)  the dispatch state, zeroed on the reset beat
 *   0x6A2D                      EFFECT_SPRITE + SPRITE_CODE (the effect sprite's +1 code field),
 *                               incremented one step per ordinary beat
 *   EFFECT_STATE      (0x6340)  parent effect state machine, re-armed to 1 on the reset beat
 *   EFFECT_PARAM_PTR  (0x6343)  param pointer, reset to the effect sprite record base (0x6A2C)
 *   0x6350                      shared engine scratch, cleared to 0 on the reset beat
 *
 * The oracle threads flags/registers through and returns via the router's dispatch tail, but no
 * caller consumes them (the router and its own caller take an independent skip decision), so the
 * contract is MEMORY-ONLY. There is NO stack-scratch exclusion: animateEffectSpriteThenRearmEffect makes no call and pushes
 * nothing — its bare `ret`s only READ the stack — so the whole RAM dump compares clean.
 *
 * The behaviour factors into three disjoint arms, and the union of the sweeps below is EXHAUSTIVE
 * over every reachable input:
 *
 *   PATH A — skip (inner pre-value != 1): decrement the inner divider and return; the written byte
 *            depends ONLY on the inner value. Swept over all 256 inner values (INNER sweep). The one
 *            value that beats (inner == 1) also runs a real step.
 *   PATH B — step beat (inner == 1, outer pre-value != 1): reload the inner divider, store the
 *            stepped outer value, and increment the sprite code. Depends on outer (the stored byte)
 *            and the sprite cell (the incremented byte) — swept over the COMPLETE 256 x 256 (outer,
 *            sprite) grid (BEAT grid).
 *   PATH C — reset beat (inner == 1, outer == 1): reload the inner divider, store outer = 0, zero
 *            EFFECT_SEQ_STATE, clear the shared scratch, re-arm EFFECT_STATE = 1, and point
 *            EFFECT_PARAM_PTR back at EFFECT_SPRITE. Its writes are constants, but they are proven
 *            against a DIRTIED base (the reset-block cells pre-set to sentinels), so a dropped reset
 *            write is caught. The BEAT grid visits this arm (at outer == 1) for every sprite value,
 *            and the STATE sweep visits it over all 256 prior state values.
 *
 *   1. EQUAL (exhaustive) — animateEffectSpriteThenRearmEffect == oracle on RAM across all three sweeps (256 + 256x256 + 256
 *      = 66048 combos). A proof by that factorisation, not a sample.
 *
 *   2. TEETH (exhaustive) — seven deliberately-broken twins, one per written cell, each of which the
 *      same sweeps MUST catch (and at that exact cell):
 *        (a) no-step          — drops the sprite increment; caught at 0x6A2D on a step beat.
 *        (b) wrong inner reload — reloads the inner divider to 6 not 12; caught at 0x6346.
 *        (c) outer reloaded    — reloads the outer divider on the reset beat (the flashEffectSpriteThenAdvanceSequence behaviour
 *                                animateEffectSpriteThenRearmEffect drops); caught at 0x6347.
 *        (d) no state reset    — leaves EFFECT_SEQ_STATE instead of zeroing it; caught at 0x6345.
 *        (e) no re-arm         — leaves EFFECT_STATE instead of setting 1; caught at 0x6340.
 *        (f) wrong param ptr   — drops the EFFECT_PARAM_PTR reset; caught at 0x6343.
 *        (g) no scratch clear  — drops the 0x6350 clear; caught at 0x6350.
 *
 *   3. REALISM (captured dispatches) — hook 0x1F23 in a real attract run (the effect sequence
 *      reaches step 2 during the demo and dispatches it across all three arms), clone the machine at
 *      each true dispatch, and confirm animateEffectSpriteThenRearmEffect reproduces the oracle's RAM on every real state.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-1f23.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1f23 as oracle } from "../../translated/loc_1f23.js";
import { animateEffectSpriteThenRearmEffect } from "../animateEffectSpriteThenRearmEffect.js";
import {
  EFFECT_SEQ_INNER,
  EFFECT_SEQ_OUTER,
  EFFECT_SEQ_STATE,
  EFFECT_STATE,
  EFFECT_PARAM_PTR,
  EFFECT_SPRITE,
  SPRITE_CODE,
} from "../names.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1f23;
const SPRITE_CELL = EFFECT_SPRITE + SPRITE_CODE; // 0x6A2D — the effect sprite's +1 code field this steps
const SHARED_SCRATCH = 0x6350; // genuinely-unnamed shared engine scratch, cleared on the reset beat

// The oracle's `ret`s pop the stack; point SP at work RAM so those pops read valid bytes (never
// I/O). The routine is a leaf that only pops (no push), so this never affects the compared memory —
// it just keeps the oracle well-defined.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * A dirtied base: the reset-block cells (EFFECT_STATE, EFFECT_PARAM_PTR, the shared scratch) pre-set
 * to sentinels distinct from the reset constants, so the reset writes carry teeth — a candidate that
 * drops any of them leaves the sentinel and the RAM diff catches it.
 */
function makeBase() {
  const b = new Machine(ROM).clone();
  b.mem.write8(EFFECT_STATE, 0x77); // reset writes 1
  b.mem.write16(EFFECT_PARAM_PTR, 0x1234); // reset writes 0x6A2C
  b.mem.write8(SHARED_SCRATCH, 0x88); // reset writes 0
  return b;
}

/**
 * A synthetic entry: a clone of `base` with the input cells set and a safe stack. Frame machinery is
 * neutralised (clone() already sets nextNmi/nextBoundary = Infinity; re-asserted here for clarity).
 */
function makeEntry(base, inner, outer, state, sprite) {
  const e = base.clone();
  e.mem.write8(EFFECT_SEQ_INNER, inner);
  e.mem.write8(EFFECT_SEQ_OUTER, outer);
  e.mem.write8(EFFECT_SEQ_STATE, state);
  e.mem.write8(SPRITE_CELL, sprite);
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and the candidate on two FRESH, byte-identical entries and diff the
 * memory-equivalence contract (RAM over the whole dump). A fresh entry per side because the routine
 * WRITES memory — a reused machine would carry the previous run forward.
 */
function runPair(base, inner, outer, state, sprite, candidate) {
  const a = makeEntry(base, inner, outer, state, sprite); // oracle
  const b = makeEntry(base, inner, outer, state, sprite); // candidate
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/**
 * The three disjoint arm sweeps, run in sequence. Returns the first mismatch (or null) and the total
 * combos compared. By the factorisation in the file header these together cover the whole (inner,
 * outer, state, sprite) reachable input space.
 */
function fullSweep(base, candidate) {
  let count = 0;

  // PATH A — every inner value with the outer divider fixed off a beat-continue (outer 5), so
  // inner == 1 runs a real step beat and every other inner value is a plain skip.
  for (let i = 0; i < 256; i++) {
    const ram = runPair(base, i, 5, 7, 0x33, candidate);
    count++;
    if (ram) return { mismatch: { inner: i, outer: 5, state: 7, sprite: 0x33, ram }, count };
  }

  // PATH B (+ PATH C's reset) — the full beat grid: inner fixed at the beat (1) over every (outer,
  // sprite). outer != 1 steps the sprite cell; outer == 1 takes the reset block.
  for (let o = 0; o < 256; o++) {
    for (let s = 0; s < 256; s++) {
      const ram = runPair(base, 1, o, 7, s, candidate);
      count++;
      if (ram) return { mismatch: { inner: 1, outer: o, state: 7, sprite: s, ram }, count };
    }
  }

  // PATH C — the reset beat over every prior state value (inner == 1, outer == 1), proving the
  // sequence state is zeroed regardless of what it held.
  for (let st = 0; st < 256; st++) {
    const ram = runPair(base, 1, 1, st, 0x33, candidate);
    count++;
    if (ram) return { mismatch: { inner: 1, outer: 1, state: st, sprite: 0x33, ram }, count };
  }

  return { mismatch: null, count };
}

const describeMismatch = (mm) =>
  mm &&
  `at inner=${hx(mm.inner)} outer=${hx(mm.outer)} state=${hx(mm.state)} sprite=${hx(mm.sprite)}: ` +
    `RAM diverges at 0x${(mm.ram.addr ?? 0).toString(16)} (${mm.ram.a}->${mm.ram.b})`;

// -- 0. REACHABILITY ----------------------------------------------------------

test("REACHABILITY: 0x1F23 is dispatched during attract", () => {
  let count = 0;
  const snap = new Map([[TARGET, (mm) => { count++; return oracle(mm); }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(3000);
  assert.ok(count > 0, "0x1F23 should be dispatched — the effect sequence reaches step 2 during the demo");
  console.log(`  REACHABILITY: ${count} natural 0x1F23 dispatches in 3000 frames`);
});

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): animateEffectSpriteThenRearmEffect == oracle across all three arm sweeps", () => {
  const base = makeBase();
  const { mismatch, count } = fullSweep(base, animateEffectSpriteThenRearmEffect);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, 256 + 256 * 256 + 256, "must have compared the full factored input space");
  console.log(`  EQUAL/exhaustive: ${count} (inner, outer, state, sprite) combos — RAM identical to the oracle`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------
//
// Each twin is the correct routine with exactly one written cell broken. Because the non-reset arms
// are otherwise identical to the oracle, the sweep's FIRST divergence lands on the broken cell.

/** BUG (a): drops the sprite increment on a step beat. Caught at 0x6A2D. */
function brokenNoStep(m) {
  const { mem } = m;
  const inner = mem.read8(EFFECT_SEQ_INNER) - 1;
  mem.write8(EFFECT_SEQ_INNER, inner);
  if (inner !== 0) return;
  mem.write8(EFFECT_SEQ_INNER, 12);
  const outer = mem.read8(EFFECT_SEQ_OUTER) - 1;
  mem.write8(EFFECT_SEQ_OUTER, outer);
  if (outer === 0) {
    mem.write8(EFFECT_SEQ_STATE, 0);
    mem.write8(SHARED_SCRATCH, 0);
    mem.write8(EFFECT_STATE, 1);
    mem.write16(EFFECT_PARAM_PTR, EFFECT_SPRITE);
    return;
  }
  // BUG: the sprite cell is never stepped.
}

/** BUG (b): reloads the inner divider to 6 instead of 12. Caught at 0x6346. */
function brokenInnerReload(m) {
  const { mem } = m;
  const inner = mem.read8(EFFECT_SEQ_INNER) - 1;
  mem.write8(EFFECT_SEQ_INNER, inner);
  if (inner !== 0) return;
  mem.write8(EFFECT_SEQ_INNER, 6); // BUG: should reload to 12
  const outer = mem.read8(EFFECT_SEQ_OUTER) - 1;
  mem.write8(EFFECT_SEQ_OUTER, outer);
  if (outer === 0) {
    mem.write8(EFFECT_SEQ_STATE, 0);
    mem.write8(SHARED_SCRATCH, 0);
    mem.write8(EFFECT_STATE, 1);
    mem.write16(EFFECT_PARAM_PTR, EFFECT_SPRITE);
    return;
  }
  mem.write8(SPRITE_CELL, mem.read8(SPRITE_CELL) + 1);
}

/** BUG (c): reloads the outer divider on the reset beat (flashEffectSpriteThenAdvanceSequence does this; animateEffectSpriteThenRearmEffect must not). Caught at 0x6347. */
function brokenOuterReloaded(m) {
  const { mem } = m;
  const inner = mem.read8(EFFECT_SEQ_INNER) - 1;
  mem.write8(EFFECT_SEQ_INNER, inner);
  if (inner !== 0) return;
  mem.write8(EFFECT_SEQ_INNER, 12);
  const outer = mem.read8(EFFECT_SEQ_OUTER) - 1;
  mem.write8(EFFECT_SEQ_OUTER, outer);
  if (outer === 0) {
    mem.write8(EFFECT_SEQ_OUTER, 4); // BUG: animateEffectSpriteThenRearmEffect leaves the outer divider at 0
    mem.write8(EFFECT_SEQ_STATE, 0);
    mem.write8(SHARED_SCRATCH, 0);
    mem.write8(EFFECT_STATE, 1);
    mem.write16(EFFECT_PARAM_PTR, EFFECT_SPRITE);
    return;
  }
  mem.write8(SPRITE_CELL, mem.read8(SPRITE_CELL) + 1);
}

/** BUG (d): leaves the sequence state instead of zeroing it on the reset beat. Caught at 0x6345. */
function brokenNoStateReset(m) {
  const { mem } = m;
  const inner = mem.read8(EFFECT_SEQ_INNER) - 1;
  mem.write8(EFFECT_SEQ_INNER, inner);
  if (inner !== 0) return;
  mem.write8(EFFECT_SEQ_INNER, 12);
  const outer = mem.read8(EFFECT_SEQ_OUTER) - 1;
  mem.write8(EFFECT_SEQ_OUTER, outer);
  if (outer === 0) {
    // BUG: EFFECT_SEQ_STATE is never zeroed.
    mem.write8(SHARED_SCRATCH, 0);
    mem.write8(EFFECT_STATE, 1);
    mem.write16(EFFECT_PARAM_PTR, EFFECT_SPRITE);
    return;
  }
  mem.write8(SPRITE_CELL, mem.read8(SPRITE_CELL) + 1);
}

/** BUG (e): leaves the parent effect state instead of re-arming it to 1. Caught at 0x6340. */
function brokenNoRearm(m) {
  const { mem } = m;
  const inner = mem.read8(EFFECT_SEQ_INNER) - 1;
  mem.write8(EFFECT_SEQ_INNER, inner);
  if (inner !== 0) return;
  mem.write8(EFFECT_SEQ_INNER, 12);
  const outer = mem.read8(EFFECT_SEQ_OUTER) - 1;
  mem.write8(EFFECT_SEQ_OUTER, outer);
  if (outer === 0) {
    mem.write8(EFFECT_SEQ_STATE, 0);
    mem.write8(SHARED_SCRATCH, 0);
    // BUG: EFFECT_STATE is never re-armed.
    mem.write16(EFFECT_PARAM_PTR, EFFECT_SPRITE);
    return;
  }
  mem.write8(SPRITE_CELL, mem.read8(SPRITE_CELL) + 1);
}

/** BUG (f): drops the param-pointer reset on the reset beat. Caught at 0x6343. */
function brokenWrongParam(m) {
  const { mem } = m;
  const inner = mem.read8(EFFECT_SEQ_INNER) - 1;
  mem.write8(EFFECT_SEQ_INNER, inner);
  if (inner !== 0) return;
  mem.write8(EFFECT_SEQ_INNER, 12);
  const outer = mem.read8(EFFECT_SEQ_OUTER) - 1;
  mem.write8(EFFECT_SEQ_OUTER, outer);
  if (outer === 0) {
    mem.write8(EFFECT_SEQ_STATE, 0);
    mem.write8(SHARED_SCRATCH, 0);
    mem.write8(EFFECT_STATE, 1);
    // BUG: EFFECT_PARAM_PTR is never reset.
    return;
  }
  mem.write8(SPRITE_CELL, mem.read8(SPRITE_CELL) + 1);
}

/** BUG (g): drops the shared-scratch clear on the reset beat. Caught at 0x6350. */
function brokenNoScratchClear(m) {
  const { mem } = m;
  const inner = mem.read8(EFFECT_SEQ_INNER) - 1;
  mem.write8(EFFECT_SEQ_INNER, inner);
  if (inner !== 0) return;
  mem.write8(EFFECT_SEQ_INNER, 12);
  const outer = mem.read8(EFFECT_SEQ_OUTER) - 1;
  mem.write8(EFFECT_SEQ_OUTER, outer);
  if (outer === 0) {
    mem.write8(EFFECT_SEQ_STATE, 0);
    // BUG: the shared scratch is never cleared.
    mem.write8(EFFECT_STATE, 1);
    mem.write16(EFFECT_PARAM_PTR, EFFECT_SPRITE);
    return;
  }
  mem.write8(SPRITE_CELL, mem.read8(SPRITE_CELL) + 1);
}

const TWINS = [
  { name: "no-step", fn: brokenNoStep, addr: SPRITE_CELL },
  { name: "wrong-inner-reload", fn: brokenInnerReload, addr: EFFECT_SEQ_INNER },
  { name: "outer-reloaded", fn: brokenOuterReloaded, addr: EFFECT_SEQ_OUTER },
  { name: "no-state-reset", fn: brokenNoStateReset, addr: EFFECT_SEQ_STATE },
  { name: "no-rearm", fn: brokenNoRearm, addr: EFFECT_STATE },
  { name: "wrong-param-ptr", fn: brokenWrongParam, addr: EFFECT_PARAM_PTR },
  { name: "no-scratch-clear", fn: brokenNoScratchClear, addr: SHARED_SCRATCH },
];

test("TEETH (exhaustive): each broken twin is CAUGHT at its own written cell", () => {
  const base = makeBase();
  for (const { name, fn, addr } of TWINS) {
    const { mismatch } = fullSweep(base, fn);
    assert.notEqual(mismatch, null, `the sweep FAILED to catch the ${name} twin — the RAM check is worthless`);
    assert.equal(
      mismatch.ram.addr,
      addr,
      `the ${name} twin must diverge at 0x${addr.toString(16)}, got ${describeMismatch(mismatch)}`,
    );
    console.log(`  TEETH/${name}: caught — ${describeMismatch(mismatch)}`);
  }
});

// -- 3. REALISM (captured dispatches) -----------------------------------------

/**
 * Hook 0x1F23 in a real attract run and clone the machine at up to K real dispatches. The effect
 * sequence reaches step 2 during the demo, so it is dispatched across all three arms. The wrapper
 * clones the entry state, then runs the oracle so the host game proceeds undisturbed.
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

// Which arm the routine takes for a given entry, from its two divider pre-values.
function classifyArm(entry) {
  const inner = entry.mem.read8(EFFECT_SEQ_INNER);
  const outer = entry.mem.read8(EFFECT_SEQ_OUTER);
  if (((inner - 1) & 0xff) !== 0) return "delay";
  return ((outer - 1) & 0xff) === 0 ? "reset" : "step";
}

test("REALISM: real captured 0x1F23 dispatches — animateEffectSpriteThenRearmEffect matches oracle RAM", () => {
  const caps = captureDispatches(256, 3000);
  assert.ok(caps.length >= 1, "expected at least one real 0x1F23 dispatch during attract");

  const arms = { delay: 0, step: 0, reset: 0 };
  for (const cap of caps) {
    arms[classifyArm(cap)]++;
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    oracle(a);
    animateEffectSpriteThenRearmEffect(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      ram,
      null,
      ram &&
        `RAM diverges on a real ${classifyArm(cap)} dispatch at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
    );
  }
  console.log(
    `  REALISM: ${caps.length} real 0x1F23 dispatches — RAM == oracle ` +
      `(${arms.delay} delay, ${arms.step} step, ${arms.reset} reset)`,
  );
});
