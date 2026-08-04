// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_311b (ROM 0x311B) — one arm of the difficulty-selected
 * frame-phase caller-skip guard family (siblings 0x3110/0x3126/0x3131).
 *
 * guard_311b is a LEAF that reads exactly one byte — FRAME (0x601A) — and returns a
 * boolean: true when it returns normally (the caller proceeds this frame), false when it
 * splices a level up (the caller's remainder is skipped). It writes NO memory and calls
 * nothing, and its only live output is that control-flow boolean (the residual A/F/SP/PC is
 * the Z80 return mechanism the idiomatic layer replaces with a JS return). So it is
 * validated the strongest way a leaf predicate can be — EXHAUSTIVELY against the frozen
 * oracle over every possible FRAME byte — not by a whole-machine trace:
 *
 *   1. EQUAL + PURITY (exhaustive) — for all 256 FRAME byte values: the oracle writes NO
 *      RAM (licensing the memory-only contract), loc_311b reproduces its boolean proceed
 *      decision, AND the two machines' RAM is byte-identical after the run (the "identical
 *      RAM writes" half of the contract — here trivially, since neither side writes). Both
 *      arms are covered: proceed while (FRAME & 7) < 5, skip while (FRAME & 7) >= 5.
 *
 *   2. TEETH (exhaustive) — two deliberately-broken twins, mirroring the two documented
 *      family traps, each of which the same 256-byte sweep MUST catch:
 *        (a) off-by-one proceed window — compares `< 4` instead of `< 5`, so it skips on the
 *            fifth phase where the oracle proceeds (caught at FRAME & 7 == 4).
 *        (b) wrong mask — masks the low 2 bits (`& 3`, a sibling's mask) instead of the low 3,
 *            so it proceeds on every phase where the oracle skips (caught at FRAME & 7 in
 *            {5,6,7}). Because the twins write no RAM either, the BOOLEAN return is what
 *            catches them — exactly this routine's live-out.
 *
 *   3. REACHABILITY — this arm is reached ONLY through gateObjectUpdateByDifficulty's difficulty-selected table
 *      and never on the live NMI/substate dispatches, so a real attract run dispatches it
 *      ZERO times. Asserted here (0 over 2000 frames) to document WHY there is no captured-
 *      dispatch section: the exhaustive sweep above is the complete proof, and if this arm
 *      ever becomes live this test flips red to demand real captures.
 *
 * The oracle must run on a clone() (frame machinery neutralised: nextNmi/nextBoundary =
 * Infinity) — otherwise an m.step inside the call could trip a live NMI, whose handler
 * writes RAM and would masquerade as an oracle side effect. SP is parked in STACK_SCRATCH
 * so the oracle's trailing `ret` (and, on the skip arm, its two `inc sp` first) pops valid
 * RAM bytes and never drifts into I/O space; it only READS the stack, so no exclusion is
 * needed and the full-RAM diff stays exact.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-311b.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_311b as oracle } from "../../translated/loc_311b.js";
import { loc_311b } from "../loc_311b.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { FRAME } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x311b;
// STACK_SCRATCH [0x6be0,0x6c00): the oracle's inc-sp/inc-sp/ret pops stay in RAM, never I/O.
const SAFE_SP = 0x6bf0;

const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * A synthetic entry: a clone of `base` with FRAME set and a safe stack. Frame machinery is
 * neutralised (clone() already sets nextNmi/nextBoundary = Infinity; re-asserted here) so
 * the oracle's m.step cannot fire an NMI or push a frame while running in isolation.
 */
function makeEntry(base, frameVal) {
  const e = base.clone();
  e.mem.write8(FRAME, frameVal & 0xff);
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Sweep all 256 FRAME values, running the oracle and `candidate` on two FRESH byte-identical
 * entries each. Returns the first FRAME value where the candidate's boolean disagrees with
 * the oracle (or null), plus the combo count. Used by the teeth twins, which write no RAM,
 * so the boolean is the discriminant.
 */
function fullBoolSweep(base, candidate) {
  let count = 0;
  for (let v = 0; v < 256; v++) {
    const a = makeEntry(base, v);
    const b = makeEntry(base, v);
    const want = oracle(a);
    const got = candidate(b);
    count++;
    if (got !== want) return { mismatch: { v, want, got }, count };
  }
  return { mismatch: null, count };
}

// -- 1. EQUAL + PURITY (exhaustive) -------------------------------------------

test("EQUAL + PURITY (exhaustive): loc_311b == oracle over all 256 FRAME bytes; identical RAM, none written", () => {
  const base = new Machine(ROM).clone();
  let count = 0;
  let proceed = 0;
  let skip = 0;
  for (let v = 0; v < 256; v++) {
    const a = makeEntry(base, v); // oracle
    const b = makeEntry(base, v); // candidate

    // PURITY: the oracle mutates no RAM (this is what licenses the memory-only contract).
    const before = a.dumpState();
    const want = oracle(a);
    const after = a.dumpState();
    const purity = firstStateDiff(before, after, (off) => a.stateOffsetToAddr(off));
    assert.equal(
      purity,
      null,
      purity && `oracle wrote RAM at 0x${(purity.addr ?? 0).toString(16)} (${purity.a}->${purity.b}) for FRAME=${hx(v)}`,
    );

    // EQUAL (boolean): loc_311b reproduces the oracle's proceed/skip decision.
    const got = loc_311b(b);
    assert.equal(got, want, `boolean mismatch at FRAME=${hx(v)}: oracle=${want} loc_311b=${got}`);
    if (want) proceed++; else skip++;

    // EQUAL (RAM): the two machines' work RAM is byte-identical after the run (neither wrote).
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      ram,
      null,
      ram && `RAM diverges at FRAME=${hx(v)} at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b})`,
    );
    count++;
  }
  assert.equal(count, 256, "must have compared all 256 FRAME byte values");
  assert.ok(proceed > 0 && skip > 0, `both arms must occur (got ${proceed} proceed, ${skip} skip)`);
  console.log(`  EQUAL+PURITY/exhaustive: ${count} FRAME values identical to the oracle (${proceed} proceed, ${skip} skip), no RAM written`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/** Broken twin (a): off-by-one proceed window — compares `< 4` where the oracle uses `< 5`. */
function brokenOffByOne(m) {
  return (m.mem.read8(FRAME) & 7) < 4; // BUG: window is one phase too narrow
}

/** Broken twin (b): wrong mask — a sibling's low-2-bit mask instead of low-3, so it proceeds
 *  on every phase where the oracle skips. */
function brokenWrongMask(m) {
  return (m.mem.read8(FRAME) & 3) < 5; // BUG: `& 3` (always true) instead of `& 7`
}

test("TEETH (exhaustive): the off-by-one-window twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullBoolSweep(base, brokenOffByOne);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a too-narrow proceed window — worthless");
  assert.equal(mismatch.v & 7, 4, "the off-by-one twin should first diverge on the fifth phase (FRAME & 7 == 4)");
  console.log(`  TEETH/off-by-one: caught at FRAME=${hx(mismatch.v)} (oracle=${mismatch.want} broken=${mismatch.got})`);
});

test("TEETH (exhaustive): the wrong-mask twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullBoolSweep(base, brokenWrongMask);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong mask — worthless");
  assert.ok((mismatch.v & 7) >= 5, "the wrong-mask twin should diverge on a skip phase (FRAME & 7 >= 5)");
  console.log(`  TEETH/mask: caught at FRAME=${hx(mismatch.v)} (oracle=${mismatch.want} broken=${mismatch.got})`);
});

// -- 3. REACHABILITY ----------------------------------------------------------

test("REACHABILITY: 0x311B is NOT naturally dispatched (exhaustive sweep is the whole proof)", () => {
  let count = 0;
  const overrides = new Map([[TARGET, (mm) => { count++; return oracle(mm); }]]);
  const host = new Machine(ROM, { overrides });
  host.runFrames(2000);
  assert.equal(count, 0, `0x311B should be unreachable on the live paths, got ${count} dispatches — a captured-dispatch section is now needed`);
  console.log(`  REACHABILITY: ${count} natural 0x311B dispatches in 2000 frames — exhaustive sweep stands alone`);
});
