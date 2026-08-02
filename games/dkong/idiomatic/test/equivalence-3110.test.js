// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_3110 (ROM 0x3110) — the head arm of the difficulty-selected
 * frame-phase caller-skip guard family (siblings 0x311b/0x3126/0x3131).
 *
 * guard_3110 is a LEAF that reads exactly one byte — FRAME (0x601A) — and returns a boolean:
 * true when it returns normally (the caller proceeds this frame), false when it splices a
 * level up (the caller's remainder is skipped). It writes NO memory and calls nothing, and
 * its only live output is that control-flow boolean (the residual A/F/SP/PC is the Z80 return
 * mechanism the idiomatic layer replaces with a JS return). So it is validated the strongest
 * way a leaf predicate can be — EXHAUSTIVELY against the frozen oracle over every possible
 * FRAME byte — not by a whole-machine trace:
 *
 *   1. EQUAL + PURITY (exhaustive) — for all 256 FRAME byte values: the oracle writes NO
 *      RAM (licensing the memory-only contract), loc_3110 reproduces its boolean proceed
 *      decision, AND the two machines' RAM is byte-identical after the run (the "identical
 *      RAM writes" half of the contract — here trivially, since neither side writes). Both
 *      arms are covered: proceed while (FRAME & 1) == 1 (odd frames), skip while it is 0.
 *
 *   2. TEETH (exhaustive) — two deliberately-broken twins, mirroring the two documented
 *      family traps, each of which the same 256-byte sweep MUST catch:
 *        (a) polarity outlier — uses the siblings' sign / less-than semantics
 *            (`(FRAME & 1) < 1`, i.e. the sign of the compare) instead of this arm's equality
 *            (`== 1`). Because the masked value is 0 or 1, `< 1` is the exact inverse of
 *            `== 1`, so the decision flips on EVERY frame — caught at the very first value.
 *        (b) wrong mask — masks the low TWO bits (`& 3`, a sibling's wider mask) and compares
 *            `== 1`, so it drops the proceed on frames whose low two bits are both set. It
 *            diverges where the oracle proceeds (bit 0 set) but the twin does not
 *            (FRAME & 3 == 3). Because the twins write no RAM either, the BOOLEAN return is
 *            what catches them — exactly this routine's live-out.
 *
 *   3. CAPTURED DISPATCH (realism) — unlike its higher-difficulty siblings, THIS arm is on a
 *      live path: handler_1977 → entry_30ed → sub_30fa clamps DIFFICULTY and, at the low
 *      difficulty attract runs at, selects this arm. So a real attract run DOES dispatch it
 *      (~1197 times over 2000 frames). The test overrides 0x3110 on a live attract machine,
 *      replays every natural dispatch, and asserts loc_3110's boolean matches the oracle's on
 *      each real live FRAME value — the "real captured dispatches" realism arm the spec asks
 *      for, standing alongside the exhaustive sweep. (The sibling tests assert 0 dispatches
 *      because their arms are never selected in attract; that is true of them, not of 0x3110.)
 *
 * The oracle must run on a clone() (frame machinery neutralised: nextNmi/nextBoundary =
 * Infinity) — otherwise an m.step inside the call could trip a live NMI, whose handler
 * writes RAM and would masquerade as an oracle side effect. SP is parked in STACK_SCRATCH
 * so the oracle's trailing `ret` (and, on the skip arm, its two `inc sp` first) pops valid
 * RAM bytes and never drifts into I/O space; it only READS the stack, so no exclusion is
 * needed and the full-RAM diff stays exact.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-3110.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3110 as oracle } from "../../translated/loc_3110.js";
import { loc_3110 } from "../loc_3110.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { FRAME } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x3110;
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

test("EQUAL + PURITY (exhaustive): loc_3110 == oracle over all 256 FRAME bytes; identical RAM, none written", () => {
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

    // EQUAL (boolean): loc_3110 reproduces the oracle's proceed/skip decision.
    const got = loc_3110(b);
    assert.equal(got, want, `boolean mismatch at FRAME=${hx(v)}: oracle=${want} loc_3110=${got}`);
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
  assert.equal(proceed, 128, "half of all frames are odd, so exactly 128 must proceed");
  console.log(`  EQUAL+PURITY/exhaustive: ${count} FRAME values identical to the oracle (${proceed} proceed, ${skip} skip), no RAM written`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/** Broken twin (a): polarity outlier — a sibling's sign / less-than semantics (`< 1`) in
 *  place of this arm's equality (`== 1`). On a value that is 0 or 1, `< 1` is the exact
 *  inverse of `== 1`, so the decision flips on every frame. */
function brokenPolarity(m) {
  return (m.mem.read8(FRAME) & 1) < 1; // BUG: sign/less-than, the exact inverse of `== 1`
}

/** Broken twin (b): wrong mask — a sibling's low-2-bit mask (`& 3`) instead of the low bit,
 *  still compared `== 1`, so it drops the proceed when both low bits are set. */
function brokenWrongMask(m) {
  return (m.mem.read8(FRAME) & 3) === 1; // BUG: `& 3` instead of `& 1`
}

test("TEETH (exhaustive): the polarity (sign/less-than) twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullBoolSweep(base, brokenPolarity);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a sign-flag polarity flip — worthless");
  // The inversion is global, so it diverges on the very first frame (FRAME=0x00, an even
  // frame where the oracle skips but the flipped twin proceeds).
  assert.equal(mismatch.v, 0, "the polarity twin inverts every frame, so it must diverge at FRAME=0x00");
  console.log(`  TEETH/polarity: caught at FRAME=${hx(mismatch.v)} (oracle=${mismatch.want} broken=${mismatch.got})`);
});

test("TEETH (exhaustive): the wrong-mask twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullBoolSweep(base, brokenWrongMask);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong mask — worthless");
  assert.equal(mismatch.v & 3, 3, "the wrong-mask twin should first diverge where both low bits are set (FRAME & 3 == 3)");
  console.log(`  TEETH/mask: caught at FRAME=${hx(mismatch.v)} (oracle=${mismatch.want} broken=${mismatch.got})`);
});

// -- 3. CAPTURED DISPATCH (realism) -------------------------------------------

test("CAPTURED DISPATCH: loc_3110 matches the oracle on every live 0x3110 dispatch (2000 attract frames)", () => {
  let count = 0;
  let mismatches = 0;
  let proceed = 0;
  let skip = 0;
  let firstBad = null;
  const seen = new Set();
  // Override 0x3110 on a live attract machine. On each real dispatch: read the live FRAME,
  // compute loc_3110's decision (a pure read), then run the oracle to drive the machine
  // faithfully (its skip arm splices SP exactly as the real guard does) and record whether
  // the two agreed. Return the oracle's boolean so the live run stays exact.
  const overrides = new Map([[TARGET, (mm) => {
    count++;
    const frame = mm.mem.read8(FRAME) & 0xff;
    seen.add(frame);
    const got = loc_3110(mm);
    const want = oracle(mm);
    if (got !== want) {
      mismatches++;
      if (firstBad === null) firstBad = { frame, got, want };
    }
    if (want) proceed++; else skip++;
    return want;
  }]]);
  const host = new Machine(ROM, { overrides });
  host.runFrames(2000);

  assert.ok(count > 0, "0x3110 is the low-difficulty arm and MUST be dispatched during attract — none seen means the live chain regressed");
  assert.equal(
    mismatches,
    0,
    firstBad && `loc_3110 disagreed with the oracle at a live FRAME=${hx(firstBad.frame)} (oracle=${firstBad.want} loc_3110=${firstBad.got})`,
  );
  assert.ok(proceed > 0 && skip > 0, `both arms should occur across live dispatches (got ${proceed} proceed, ${skip} skip)`);
  console.log(`  CAPTURED DISPATCH: ${count} live 0x3110 dispatches over 2000 frames (${proceed} proceed, ${skip} skip), ${seen.size} distinct FRAME values, 0 mismatches`);
});
