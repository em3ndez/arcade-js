// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_1f09 (ROM 0x1F09) — effect-sequence step 1, a two-stage rate
 * divider that flips a sprite-shadow bit on most beats and advances the sequence state on
 * every fourth.
 *
 * loc_1f09 is a LEAF (no callees). Its entire memory-observable behaviour is a function of
 * FOUR bytes and it writes only those same four cells:
 *
 *   EFFECT_SEQ_INNER  (0x6346)  the fast divider, ticked every dispatch
 *   EFFECT_SEQ_OUTER  (0x6347)  the slow divider, ticked on each beat
 *   EFFECT_SEQ_STATE  (0x6345)  the dispatch state, advanced on the fourth beat
 *   0x6A2D                      EFFECT_SPRITE + 1 (the effect sprite's +1 SPRITE_CODE field),
 *                               the sprite-shadow byte whose low bit is flashed
 *
 * The oracle threads flags/registers through and returns via the router's dispatch tail,
 * but no caller consumes them (the router and its own caller take an independent skip
 * decision), so the contract is MEMORY-ONLY. That factors into three disjoint arms, and the
 * union of the sweeps below is EXHAUSTIVE over every reachable input:
 *
 *   PATH A — skip (inner pre-value != 1): decrement the inner divider and return; the
 *            written byte depends ONLY on the inner value. Swept over all 256 inner values
 *            (INNER sweep). The one value that beats (inner == 1) also runs a real flash.
 *   PATH B — flash beat (inner == 1, outer pre-value != 1): reload the inner divider, store
 *            the stepped outer value, and flip the sprite cell's low bit. Depends on outer
 *            (the stored byte) and the sprite cell (the flipped byte) — two independent
 *            writes, swept over the COMPLETE 256 x 256 (outer, sprite) grid (BEAT grid).
 *   PATH C — advance beat (inner == 1, outer == 1): reload both dividers and advance the
 *            sequence state = state + 1. The advanced byte depends on the state value, swept
 *            over all 256 states (STATE sweep). The BEAT grid also visits this arm (at
 *            outer == 1) so the reloads are covered for every sprite value too.
 *
 *   1. EQUAL (exhaustive) — loc_1f09 == oracle on RAM across all three sweeps (256 + 256x256
 *      + 256 = 66048 combos). A proof by that factorisation, not a sample.
 *
 *   2. TEETH (exhaustive) — four deliberately-broken twins, one per written cell, each of
 *      which the same sweeps MUST catch (and at that exact cell):
 *        (a) no-flash        — drops the sprite bit flip; caught at 0x6A2D on the flash beat.
 *        (b) wrong inner reload — reloads the inner divider to 5 not 6; caught at 0x6346.
 *        (c) wrong advance    — steps the state down not up; caught at EFFECT_SEQ_STATE.
 *        (d) wrong outer reload — reloads the outer divider to 3 not 4; caught at 0x6347.
 *
 *   3. REALISM (captured dispatches) — hook 0x1F09 in a real attract run (the effect
 *      sequence runs during the demo and dispatches this step across all three arms), clone
 *      the machine at each true dispatch, and confirm loc_1f09 reproduces the oracle's RAM
 *      on every real state the game actually produces.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-1f09.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1f09 as oracle } from "../../translated/loc_1f09.js";
import { loc_1f09 } from "../loc_1f09.js";
import { EFFECT_SEQ_INNER, EFFECT_SEQ_OUTER, EFFECT_SEQ_STATE, EFFECT_SPRITE } from "../ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1f09;
const SPRITE_CELL = EFFECT_SPRITE + 1; // 0x6A2D — the effect sprite's +1 SPRITE_CODE field this routine flashes

// The oracle's `ret`s pop the stack; point SP at work RAM so those pops read valid bytes
// (never I/O). The routine is a leaf that only pops (no push), so this never affects the
// compared memory — it just keeps the oracle well-defined.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * A synthetic entry: a clone of `base` with the four input cells set and a safe stack.
 * Frame machinery is neutralised (clone() already sets nextNmi/nextBoundary = Infinity;
 * re-asserted here for clarity) so the oracle's `m.step` cannot fire an NMI while running
 * in isolation.
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
 * memory-equivalence contract (RAM over the whole dump). A fresh entry per side because
 * the routine WRITES memory — a reused machine would carry the previous run forward.
 */
function runPair(base, inner, outer, state, sprite, candidate) {
  const a = makeEntry(base, inner, outer, state, sprite); // oracle
  const b = makeEntry(base, inner, outer, state, sprite); // candidate
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/**
 * The three disjoint arm sweeps, run in sequence. Returns the first mismatch (or null) and
 * the total combos compared. By the factorisation in the file header these together cover
 * the whole (inner, outer, state, sprite) reachable input space.
 */
function fullSweep(base, candidate) {
  let count = 0;

  // PATH A — every inner value with the outer divider fixed off a beat-continue (outer 3),
  // so inner == 1 runs a real flash beat and every other inner value is a plain skip.
  for (let i = 0; i < 256; i++) {
    const ram = runPair(base, i, 3, 5, 0x10, candidate);
    count++;
    if (ram) return { mismatch: { inner: i, outer: 3, state: 5, sprite: 0x10, ram }, count };
  }

  // PATH B (+ PATH C's reloads) — the full beat grid: inner fixed at the beat (1) over every
  // (outer, sprite). outer != 1 flips the sprite cell; outer == 1 takes the advance reloads.
  for (let o = 0; o < 256; o++) {
    for (let s = 0; s < 256; s++) {
      const ram = runPair(base, 1, o, 5, s, candidate);
      count++;
      if (ram) return { mismatch: { inner: 1, outer: o, state: 5, sprite: s, ram }, count };
    }
  }

  // PATH C — the advance beat over every state value (inner == 1, outer == 1).
  for (let st = 0; st < 256; st++) {
    const ram = runPair(base, 1, 1, st, 0x10, candidate);
    count++;
    if (ram) return { mismatch: { inner: 1, outer: 1, state: st, sprite: 0x10, ram }, count };
  }

  return { mismatch: null, count };
}

const describeMismatch = (mm) =>
  mm &&
  `at inner=${hx(mm.inner)} outer=${hx(mm.outer)} state=${hx(mm.state)} sprite=${hx(mm.sprite)}: ` +
    `RAM diverges at 0x${(mm.ram.addr ?? 0).toString(16)} (${mm.ram.a}->${mm.ram.b})`;

// -- 0. REACHABILITY ----------------------------------------------------------

test("REACHABILITY: 0x1F09 is dispatched during attract", () => {
  let count = 0;
  const snap = new Map([[TARGET, (mm) => { count++; return oracle(mm); }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(3000);
  assert.ok(count > 0, "0x1F09 should be dispatched — the effect sequence runs during the demo");
  console.log(`  REACHABILITY: ${count} natural 0x1F09 dispatches in 3000 frames`);
});

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): loc_1f09 == oracle across all three arm sweeps", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_1f09);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, 256 + 256 * 256 + 256, "must have compared the full factored input space");
  console.log(`  EQUAL/exhaustive: ${count} (inner, outer, state, sprite) combos — RAM identical to the oracle`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/** BUG (a): drops the sprite bit flip on the flash beat. Caught at 0x6A2D. */
function brokenNoFlash(m) {
  const { mem } = m;
  const inner = mem.read8(EFFECT_SEQ_INNER) - 1;
  mem.write8(EFFECT_SEQ_INNER, inner);
  if (inner !== 0) return;
  mem.write8(EFFECT_SEQ_INNER, 6);
  const outer = mem.read8(EFFECT_SEQ_OUTER) - 1;
  if (outer === 0) {
    mem.write8(EFFECT_SEQ_OUTER, 4);
    mem.write8(EFFECT_SEQ_STATE, mem.read8(EFFECT_SEQ_STATE) + 1);
    return;
  }
  mem.write8(EFFECT_SEQ_OUTER, outer);
  // BUG: the sprite cell is never flipped.
}

/** BUG (b): reloads the inner divider to 5 instead of 6. Caught at 0x6346. */
function brokenInnerReload(m) {
  const { mem } = m;
  const inner = mem.read8(EFFECT_SEQ_INNER) - 1;
  mem.write8(EFFECT_SEQ_INNER, inner);
  if (inner !== 0) return;
  mem.write8(EFFECT_SEQ_INNER, 5); // BUG: should reload to 6
  const outer = mem.read8(EFFECT_SEQ_OUTER) - 1;
  if (outer === 0) {
    mem.write8(EFFECT_SEQ_OUTER, 4);
    mem.write8(EFFECT_SEQ_STATE, mem.read8(EFFECT_SEQ_STATE) + 1);
    return;
  }
  mem.write8(EFFECT_SEQ_OUTER, outer);
  mem.write8(SPRITE_CELL, mem.read8(SPRITE_CELL) ^ 0x01);
}

/** BUG (c): steps the sequence state DOWN instead of up on the advance beat. Caught at 0x6345. */
function brokenAdvanceDir(m) {
  const { mem } = m;
  const inner = mem.read8(EFFECT_SEQ_INNER) - 1;
  mem.write8(EFFECT_SEQ_INNER, inner);
  if (inner !== 0) return;
  mem.write8(EFFECT_SEQ_INNER, 6);
  const outer = mem.read8(EFFECT_SEQ_OUTER) - 1;
  if (outer === 0) {
    mem.write8(EFFECT_SEQ_OUTER, 4);
    mem.write8(EFFECT_SEQ_STATE, mem.read8(EFFECT_SEQ_STATE) - 1); // BUG: should be + 1
    return;
  }
  mem.write8(EFFECT_SEQ_OUTER, outer);
  mem.write8(SPRITE_CELL, mem.read8(SPRITE_CELL) ^ 0x01);
}

/** BUG (d): reloads the outer divider to 3 instead of 4 on the advance beat. Caught at 0x6347. */
function brokenOuterReload(m) {
  const { mem } = m;
  const inner = mem.read8(EFFECT_SEQ_INNER) - 1;
  mem.write8(EFFECT_SEQ_INNER, inner);
  if (inner !== 0) return;
  mem.write8(EFFECT_SEQ_INNER, 6);
  const outer = mem.read8(EFFECT_SEQ_OUTER) - 1;
  if (outer === 0) {
    mem.write8(EFFECT_SEQ_OUTER, 3); // BUG: should reload to 4
    mem.write8(EFFECT_SEQ_STATE, mem.read8(EFFECT_SEQ_STATE) + 1);
    return;
  }
  mem.write8(EFFECT_SEQ_OUTER, outer);
  mem.write8(SPRITE_CELL, mem.read8(SPRITE_CELL) ^ 0x01);
}

test("TEETH (exhaustive): the no-flash twin is CAUGHT (sprite cell diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenNoFlash);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a dropped sprite flip — the RAM check is worthless");
  assert.equal(mismatch.ram.addr, SPRITE_CELL, "the no-flash twin must diverge on the sprite cell 0x6A2D");
  console.log(`  TEETH/no-flash: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the wrong-inner-reload twin is CAUGHT (0x6346 diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenInnerReload);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong inner reload — worthless");
  assert.equal(mismatch.ram.addr, EFFECT_SEQ_INNER, "the wrong-inner-reload twin must diverge on 0x6346");
  console.log(`  TEETH/inner-reload: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the wrong-advance twin is CAUGHT (state diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenAdvanceDir);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong state advance — worthless");
  assert.equal(mismatch.ram.addr, EFFECT_SEQ_STATE, "the wrong-advance twin must diverge on EFFECT_SEQ_STATE 0x6345");
  console.log(`  TEETH/advance: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the wrong-outer-reload twin is CAUGHT (0x6347 diverges)", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenOuterReload);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong outer reload — worthless");
  assert.equal(mismatch.ram.addr, EFFECT_SEQ_OUTER, "the wrong-outer-reload twin must diverge on 0x6347");
  console.log(`  TEETH/outer-reload: caught — ${describeMismatch(mismatch)}`);
});

// -- 3. REALISM (captured dispatches) -----------------------------------------

/**
 * Hook 0x1F09 in a real attract run and clone the machine at up to K real dispatches. The
 * effect sequence runs during the demo, so it is dispatched across all three arms. The
 * wrapper clones the entry state, then runs the oracle so the host game proceeds undisturbed.
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
  return ((outer - 1) & 0xff) === 0 ? "advance" : "flash";
}

test("REALISM: real captured 0x1F09 dispatches — loc_1f09 matches oracle RAM", () => {
  const caps = captureDispatches(256, 3000);
  assert.ok(caps.length >= 1, "expected at least one real 0x1F09 dispatch during attract");

  const arms = { delay: 0, flash: 0, advance: 0 };
  for (const cap of caps) {
    arms[classifyArm(cap)]++;
    const a = cap.clone(); // oracle
    const b = cap.clone(); // candidate
    a.nextNmi = Infinity; a.nextBoundary = Infinity;
    b.nextNmi = Infinity; b.nextBoundary = Infinity;
    oracle(a);
    loc_1f09(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      ram,
      null,
      ram &&
        `RAM diverges on a real ${classifyArm(cap)} dispatch at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
    );
  }
  console.log(
    `  REALISM: ${caps.length} real 0x1F09 dispatches — RAM == oracle ` +
      `(${arms.delay} delay, ${arms.flash} flash, ${arms.advance} advance)`,
  );
});
