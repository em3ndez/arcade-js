// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2be1 (ROM 0x2BE1) — the airborne-descent tile-landing
 * resolver, the tail of the tile-classifier gate entry_2b9b.
 *
 * The routine reduces its whole memory-observable behaviour to ONE comparison:
 *
 *     probe = u8(MARIO_AIR_PREV_Y - objectY + rowOffset)  vs  boundary C
 *
 * (objectY is the caller's object record field +5, rowOffset is the accumulator the
 * classifier passes, C is the tile-column boundary). Two arms:
 *
 *   ABOVE (probe >  C): report code 2 in A, 0 in B, return NORMALLY (true). No write.
 *   AT/BELOW (probe <= C): snap MARIO_Y = C - 7, report code 1 in A, 1 in B, and take
 *     the TWO-FRAME unwind (`pop hl; pop hl; ret`) — expressed as returning false under
 *     the caller-skip convention.
 *
 * So the live-out is memory (MARIO_Y on the at/below arm) PLUS the register result code
 * A (2 vs 1) and its twin B, PLUS the control flow (normal return vs two-frame unwind).
 * The candidate models no stack; the harness performs the matching pops/ret AFTER it so
 * pc + SP line up with the oracle — and a wrong boolean therefore diverges on pc/SP.
 * The oracle only POPS the stack (never pushes), so the memory-equivalence RAM diff over
 * the whole dump is already clean and needs no stack-scratch exclusion.
 *
 *   1. EQUAL (exhaustive decision) — the observable output is a pure function of
 *      (probe, C). Realising probe directly (airPrevY = probe, objectY = 0, rowOffset = 0),
 *      sweep the COMPLETE 256x256 (probe, C) grid and assert loc_2be1 == oracle on
 *      RAM + pc + SP + A + B. This is a proof over the whole decision space, covering both
 *      arms, the probe == C boundary (proves `<=` not `<`), and every C - 7 snap value.
 *
 *   2. EQUAL (arithmetic) — pins probe = u8(airPrevY - objectY + rowOffset) against the
 *      oracle by a boundary-set cross-product over the three summands at boundaries C that
 *      make an unwrapped result straddle C differently (C = 0x80, 0x07, 0xF7). This is what
 *      the un-wrapped-probe twin below must fail.
 *
 *   3. TEETH — five deliberately-broken twins, each of which the sweeps MUST catch:
 *      (a) wrong snap value (C - 6) — caught on the at/below arm at MARIO_Y.
 *      (b) wrong boundary (>= not >) — the probe == C case flips arms; caught on RAM + A + pc/SP.
 *      (c) wrong result code (A = 3 on the above arm) — caught on the register live-out A.
 *      (d) wrong control flow (returns true on the landed arm) — caught on pc + SP.
 *      (e) dropped arithmetic wrap (no u8) — caught by the arithmetic sweep.
 *
 *   4. REALISM (captured dispatches) — hook 0x2BE1 in a real attract run (the collision
 *      probe reaches it), clone at each real dispatch, and confirm loc_2be1 reproduces the
 *      oracle on every real state the game actually produces (both arms occur).
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2be1.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2be1 as oracle } from "../../translated/loc_2be1.js";
import { resolveAirborneTileLanding as loc_2be1 } from "../resolveAirborneTileLanding.js";
import { MARIO_Y, MARIO_AIR_PREV_Y } from "../ram.js";
import { u8 } from "../../../../core/int.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2be1;
const OBJ_IX = 0x6200;                 // the object record base the caller passes (Mario, observed)
const SP_TOP = 0x6c00;                 // crafted stack top (in work RAM)
const R1 = 0x0111, R2 = 0x0222, R3 = 0x0333; // distinct sentinel return frames

const hx = (v) => "0x" + (v & 0xffff).toString(16);

/**
 * Stamp a crafted 3-deep stack: this routine's own return (R1) and the caller's
 * return (R2) — both discarded on the two-frame unwind — over the real unwind
 * target (R3). Distinct values so a wrong control-flow twin diverges on pc.
 */
function stampStack(m) {
  m.regs.sp = SP_TOP;
  m.push16(R3);
  m.push16(R2);
  m.push16(R1);
}

/** A crafted entry realising a given (probe, C) directly: probe = airPrevY - 0 + 0. */
function sweepEntry(base, probe, C) {
  const m = base.clone();
  m.regs.ix = OBJ_IX;
  m.mem.write8((OBJ_IX + 5) & 0xffff, 0x00); // object Y = 0 -> probe == airPrevY
  m.mem.write8(MARIO_AIR_PREV_Y, probe & 0xff);
  m.regs.e = 0x00;                            // rowOffset = 0
  m.regs.c = C & 0xff;
  stampStack(m);
  m.nextNmi = Infinity;
  m.nextBoundary = Infinity;
  return m;
}

/** A crafted entry setting the three summands and C independently (arithmetic sweep). */
function arithEntry(base, airPrevY, objectY, rowOffset, C) {
  const m = base.clone();
  m.regs.ix = OBJ_IX;
  m.mem.write8((OBJ_IX + 5) & 0xffff, objectY & 0xff);
  m.mem.write8(MARIO_AIR_PREV_Y, airPrevY & 0xff);
  m.regs.e = rowOffset & 0xff;
  m.regs.c = C & 0xff;
  stampStack(m);
  m.nextNmi = Infinity;
  m.nextBoundary = Infinity;
  return m;
}

/** Run the ORACLE on a fresh clone. It performs its own ret / two-frame unwind. */
function runOracle(entry) {
  const c = entry.clone();
  c.nextNmi = Infinity;
  c.nextBoundary = Infinity;
  oracle(c);
  return c;
}

/**
 * Run a candidate on a fresh clone, then model its terminal control flow from the
 * boolean it returns so pc + SP match the oracle: true -> one caller-return pop;
 * false -> discard two frames then return (the caller-skip two-frame unwind).
 */
function runCandidate(entry, fn) {
  const c = entry.clone();
  c.nextNmi = Infinity;
  c.nextBoundary = Infinity;
  const normal = fn(c);
  if (normal) {
    c.ret();
  } else {
    c.pop16();
    c.pop16();
    c.ret();
  }
  return c;
}

/** Full contract diff: RAM (whole dump) + pc + SP + the register live-outs A and B. */
function contractDiffs(entry, fn) {
  const o = runOracle(entry);
  const c = runCandidate(entry, fn);
  const diffs = [];
  const ram = firstStateDiff(o.dumpState(), c.dumpState(), (off) => o.stateOffsetToAddr(off));
  if (ram) diffs.push(`RAM@${hx(ram.addr ?? 0)} oracle=${ram.a} cand=${ram.b}`);
  if (o.pc !== c.pc) diffs.push(`pc oracle=${hx(o.pc)} cand=${hx(c.pc)}`);
  if (o.regs.sp !== c.regs.sp) diffs.push(`SP oracle=${hx(o.regs.sp)} cand=${hx(c.regs.sp)}`);
  if (o.regs.a !== c.regs.a) diffs.push(`A oracle=${o.regs.a} cand=${c.regs.a}`);
  if (o.regs.b !== c.regs.b) diffs.push(`B oracle=${o.regs.b} cand=${c.regs.b}`);
  return diffs;
}

// A real, self-consistent machine for realistic work RAM; the crafted entries poke
// every input the routine reads, so the base's own gameplay state is irrelevant.
function attractBase(frames = 240) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone();
}

// -- sweeps -------------------------------------------------------------------

const BSET = [0, 1, 2, 6, 7, 8, 9, 127, 128, 129, 200, 247, 248, 254, 255];
const CSET = [0x80, 0x07, 0xf7];

function fullDecisionSweep(base, candidate) {
  let count = 0;
  for (let C = 0; C < 256; C++) {
    for (let probe = 0; probe < 256; probe++) {
      const diffs = contractDiffs(sweepEntry(base, probe, C), candidate);
      count++;
      if (diffs.length) return { mismatch: { probe, C, diffs }, count };
    }
  }
  return { mismatch: null, count };
}

function fullArithSweep(base, candidate) {
  let count = 0;
  for (const C of CSET) {
    for (const airPrevY of BSET) {
      for (const objectY of BSET) {
        for (const rowOffset of BSET) {
          const diffs = contractDiffs(arithEntry(base, airPrevY, objectY, rowOffset, C), candidate);
          count++;
          if (diffs.length) return { mismatch: { airPrevY, objectY, rowOffset, C, diffs }, count };
        }
      }
    }
  }
  return { mismatch: null, count };
}

const describeDecision = (mm) =>
  mm && `at probe=${hx(mm.probe)} C=${hx(mm.C)}: ${mm.diffs.join("; ")}`;
const describeArith = (mm) =>
  mm &&
  `at airPrevY=${hx(mm.airPrevY)} objectY=${hx(mm.objectY)} rowOffset=${hx(mm.rowOffset)} ` +
    `C=${hx(mm.C)}: ${mm.diffs.join("; ")}`;

// -- 0. reachability ----------------------------------------------------------

test("REACHABILITY: 0x2BE1 is dispatched during attract", () => {
  let count = 0;
  const snap = new Map([[TARGET, (mm) => { count++; return oracle(mm); }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(4000);
  assert.ok(count > 0, "0x2BE1 should be dispatched during attract collision");
  console.log(`  REACHABILITY: ${count} natural 0x2BE1 dispatches in 4000 frames`);
});

// -- 1. EQUAL (exhaustive decision) -------------------------------------------

test("EQUAL (exhaustive): loc_2be1 == oracle over the whole 256x256 (probe, C) grid", () => {
  const base = attractBase();
  const { mismatch, count } = fullDecisionSweep(base, loc_2be1);
  assert.equal(mismatch, null, describeDecision(mismatch));
  assert.equal(count, 256 * 256, "must have compared the full (probe, C) decision space");
  console.log(`  EQUAL/exhaustive: ${count} (probe, C) combos — RAM + pc + SP + A + B identical to the oracle`);
});

// -- 2. EQUAL (arithmetic) ----------------------------------------------------

test("EQUAL (arithmetic): loc_2be1 == oracle over the summand boundary cross-product", () => {
  const base = attractBase();
  const { mismatch, count } = fullArithSweep(base, loc_2be1);
  assert.equal(mismatch, null, describeArith(mismatch));
  assert.equal(count, CSET.length * BSET.length ** 3, "must have compared the full arithmetic grid");
  console.log(`  EQUAL/arithmetic: ${count} (airPrevY, objectY, rowOffset, C) combos — identical to the oracle`);
});

// -- 3. TEETH -----------------------------------------------------------------

function probeOf(m) {
  const { regs, mem } = m;
  const objectY = mem.read8((regs.ix + 5) & 0xffff);
  return u8(mem.read8(MARIO_AIR_PREV_Y) - objectY + regs.e);
}

/** (a) wrong snap value: MARIO_Y = C - 6 instead of C - 7. */
function brokenSnapValue(m) {
  const { regs, mem } = m;
  if (probeOf(m) > regs.c) { regs.a = 2; regs.b = 0; return true; }
  mem.write8(MARIO_Y, regs.c - 6); // BUG
  regs.a = 1; regs.b = 1; return false;
}

/** (b) wrong boundary: `>=` treats probe == C as ABOVE, flipping the arm. */
function brokenBoundary(m) {
  const { regs, mem } = m;
  if (probeOf(m) >= regs.c) { regs.a = 2; regs.b = 0; return true; } // BUG: >=
  mem.write8(MARIO_Y, regs.c - 7);
  regs.a = 1; regs.b = 1; return false;
}

/** (c) wrong register live-out: result code 3 instead of 2 on the above arm. */
function brokenResultCode(m) {
  const { regs, mem } = m;
  if (probeOf(m) > regs.c) { regs.a = 3; regs.b = 0; return true; } // BUG: A=3
  mem.write8(MARIO_Y, regs.c - 7);
  regs.a = 1; regs.b = 1; return false;
}

/** (d) wrong control flow: returns true on the landed arm (no two-frame unwind). */
function brokenControlFlow(m) {
  const { regs, mem } = m;
  if (probeOf(m) > regs.c) { regs.a = 2; regs.b = 0; return true; }
  mem.write8(MARIO_Y, regs.c - 7);
  regs.a = 1; regs.b = 1; return true; // BUG: should be false (double-skip)
}

/** (e) dropped arithmetic wrap: no u8() on the probe. */
function brokenNoWrap(m) {
  const { regs, mem } = m;
  const objectY = mem.read8((regs.ix + 5) & 0xffff);
  const probe = mem.read8(MARIO_AIR_PREV_Y) - objectY + regs.e; // BUG: no u8()
  if (probe > regs.c) { regs.a = 2; regs.b = 0; return true; }
  mem.write8(MARIO_Y, regs.c - 7);
  regs.a = 1; regs.b = 1; return false;
}

test("TEETH: the wrong-snap-value twin is CAUGHT (MARIO_Y diverges)", () => {
  const base = attractBase();
  const { mismatch } = fullDecisionSweep(base, brokenSnapValue);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong snap value — worthless");
  assert.ok(mismatch.diffs.some((d) => d.startsWith(`RAM@${hx(MARIO_Y)}`)),
    `expected the snap twin to diverge on MARIO_Y, got ${mismatch.diffs.join("; ")}`);
  console.log(`  TEETH/snap: caught — ${describeDecision(mismatch)}`);
});

test("TEETH: the wrong-boundary twin is CAUGHT (probe == C flips the arm)", () => {
  const base = attractBase();
  const { mismatch } = fullDecisionSweep(base, brokenBoundary);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a `<` vs `<=` boundary error — worthless");
  console.log(`  TEETH/boundary: caught — ${describeDecision(mismatch)}`);
});

test("TEETH: the wrong-result-code twin is CAUGHT (register live-out A diverges)", () => {
  const base = attractBase();
  const { mismatch } = fullDecisionSweep(base, brokenResultCode);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong result code — the register live-out is untested");
  assert.ok(mismatch.diffs.some((d) => d.startsWith("A ")),
    `expected the result-code twin to diverge on A, got ${mismatch.diffs.join("; ")}`);
  console.log(`  TEETH/resultCode: caught — ${describeDecision(mismatch)}`);
});

test("TEETH: the wrong-control-flow twin is CAUGHT (pc/SP diverge)", () => {
  const base = attractBase();
  const { mismatch } = fullDecisionSweep(base, brokenControlFlow);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a dropped two-frame unwind — the control flow is untested");
  assert.ok(mismatch.diffs.some((d) => d.startsWith("pc ") || d.startsWith("SP ")),
    `expected the control-flow twin to diverge on pc/SP, got ${mismatch.diffs.join("; ")}`);
  console.log(`  TEETH/controlFlow: caught — ${describeDecision(mismatch)}`);
});

test("TEETH: the dropped-wrap twin is CAUGHT (arithmetic sweep)", () => {
  const base = attractBase();
  const { mismatch } = fullArithSweep(base, brokenNoWrap);
  assert.notEqual(mismatch, null, "the arithmetic sweep FAILED to catch a dropped u8 wrap — worthless");
  console.log(`  TEETH/noWrap: caught — ${describeArith(mismatch)}`);
});

// -- 4. REALISM (captured dispatches) -----------------------------------------

test("REALISM: real captured 0x2BE1 dispatches — loc_2be1 matches the oracle", () => {
  const caps = [];
  const snap = new Map([[TARGET, (mm) => {
    if (caps.length < 64) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(4000);
  assert.ok(caps.length >= 1, "expected at least one real 0x2BE1 dispatch during attract");

  let sawAbove = 0, sawLanded = 0;
  for (const cap of caps) {
    const diffs = contractDiffs(cap, loc_2be1);
    assert.equal(diffs.length, 0, `captured dispatch: ${diffs.join("; ")}`);
    if (runOracle(cap).regs.a === 1) sawLanded++; else sawAbove++;
  }
  console.log(`  REALISM: ${caps.length} real 0x2BE1 dispatches — identical to the oracle (${sawAbove} above, ${sawLanded} landed)`);
});
