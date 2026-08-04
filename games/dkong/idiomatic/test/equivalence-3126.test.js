// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_3126 (ROM 0x3126) — the three-quarters frame-throttle guard.
 *
 * guard_3126 is a LEAF that reads exactly one byte — FRAME (0x601A) — and returns a boolean:
 * true when it returns normally (the caller proceeds), false when it splices two levels up
 * (the caller's remainder is skipped). It writes no memory and calls nothing, and its only
 * live output is that control-flow boolean (SP/PC/flags are the Z80 return mechanism the
 * idiomatic layer replaces with a JS return). Because the whole input is a single byte, it
 * is validated the strongest way a leaf predicate can be — EXHAUSTIVELY against the frozen
 * oracle over every possible FRAME value — not by a whole-machine trace:
 *
 *   1. EQUAL + PURITY (exhaustive) — for all 256 FRAME byte values, the oracle writes NO RAM
 *      (licensing the memory-only contract) and loc_3126 reproduces its boolean skip
 *      decision. Both arms are covered: proceed on 192 values (FRAME & 3 != 3) and skip on
 *      the 64 where FRAME & 3 == 3.
 *
 *   2. TEETH (exhaustive) — two deliberately-broken twins the same 256-byte sweep MUST catch:
 *        (a) sibling-arm confusion — tests FRAME & 7 == 7 (copying the 0x3131 arm's mask and
 *            compare). It agrees with the oracle on six of eight low-3-bit residues and
 *            differs exactly where FRAME & 7 == 3, the silent family-copy trap.
 *        (b) polarity inversion — returns FRAME & 3 == 3 (proceed/skip flipped); caught at
 *            the very first value.
 *
 *   3. REALISM + PURITY (crafted entries) — the family is reached only through gateObjectUpdateByDifficulty's
 *      untranslated rst-0x28 difficulty table, so attract NEVER dispatches 0x3126 (the
 *      REACHABILITY probe below confirms 0 natural hits). In place of captured dispatches,
 *      take a real booted+attract machine and poke FRAME to representative values (both
 *      arms, plus high bytes) identically on both sides, then confirm the oracle writes no
 *      memory and loc_3126 reproduces its boolean on those in-distribution full-machine
 *      states.
 *
 * The oracle must be run on a clone() (frame machinery neutralised: nextNmi/nextBoundary =
 * Infinity) — otherwise an m.step inside the call could trip a live NMI, whose handler
 * writes RAM and would masquerade as an oracle side effect.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-3126.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_3126 as oracle } from "../../translated/loc_3126.js";
import { loc_3126 } from "../loc_3126.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { FRAME } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x3126;
const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

// Park SP inside STACK_SCRATCH [0x6be0,0x6c00): the oracle's trailing `ret` (and, on the
// skip arm, the two `inc sp` first) then pops valid RAM bytes and never drifts into I/O.
const SAFE_SP = 0x6bf0;

/**
 * Run the frozen oracle for one FRAME byte and return its boolean skip decision. The
 * machine may be shared across values because the oracle writes NO memory (a read-only
 * leaf); it is a clone() so its frame machinery is neutralised.
 */
function runOracleBool(m, frameVal) {
  m.mem.write8(FRAME, frameVal & 0xff);
  m.regs.sp = SAFE_SP;
  return oracle(m);
}

// -- 0. REACHABILITY ----------------------------------------------------------
//
// Documents (and pins) that the 0x3110 guard family is not wired into any executed
// dispatch: attract runs it zero times. If this ever fails, the family got wired in and
// the crafted-entry section below should be upgraded to real captured dispatches.

test("REACHABILITY: 0x3126 is NOT dispatched during attract (family reached only via gateObjectUpdateByDifficulty's untranslated table)", () => {
  let count = 0;
  const snap = new Map([[TARGET, (mm) => { count++; return oracle(mm); }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(1500);
  assert.equal(count, 0, `expected 0 natural 0x3126 dispatches; got ${count} — the family is now wired in, switch REALISM to captured dispatches`);
  console.log(`  REACHABILITY: ${count} natural 0x3126 dispatches in 1500 attract frames (crafted entries stand in below)`);
});

// -- 1. EQUAL + PURITY (exhaustive) -------------------------------------------

test("EQUAL + PURITY (exhaustive): loc_3126 == oracle over all 256 FRAME bytes; oracle writes no RAM", () => {
  const m = new Machine(ROM).clone();
  let count = 0;
  let proceed = 0;
  let skip = 0;
  for (let v = 0; v < 256; v++) {
    m.mem.write8(FRAME, v);
    m.regs.sp = SAFE_SP;

    // PURITY: the oracle mutates no RAM (this is what licenses the memory-only contract).
    const before = m.dumpState();
    const want = oracle(m);
    const after = m.dumpState();
    const d = firstStateDiff(before, after, (off) => m.stateOffsetToAddr(off));
    assert.equal(
      d,
      null,
      d && `oracle wrote RAM at 0x${(d.addr ?? 0).toString(16)} (${d.a}->${d.b}) for FRAME=${hx(v)}`,
    );

    // EQUAL: loc_3126 reproduces the oracle's boolean skip decision.
    const got = loc_3126(m);
    count++;
    if (want) proceed++; else skip++;
    assert.equal(got, want, `mismatch at FRAME=${hx(v)}: oracle=${want} loc_3126=${got}`);
  }
  assert.equal(count, 256, "must have compared all 256 FRAME byte values");
  assert.equal(skip, 64, "exactly the 64 values with FRAME & 3 == 3 must skip");
  assert.equal(proceed, 192, "the other 192 values must proceed");
  console.log(`  EQUAL+PURITY/exhaustive: ${count} FRAME values identical to the oracle (${proceed} proceed, ${skip} skip), no RAM written`);
});

// -- 2. TEETH (exhaustive) ----------------------------------------------------

/**
 * Broken twin (a): copies the 0x3131 sibling's mask and compare — FRAME & 7 == 7 instead
 * of FRAME & 3 == 3. It agrees with the oracle on six of eight low-3-bit residues and
 * differs exactly where FRAME & 7 == 3 (the correct arm skips there; this twin proceeds).
 */
function brokenSiblingArm(m) {
  return (m.mem.read8(FRAME) & 0x07) !== 0x07; // BUG: the 0x3131 arm, not the 0x3126 arm
}

/** Broken twin (b): flips proceed/skip — the polarity trap the family header warns of. */
function brokenPolarity(m) {
  return (m.mem.read8(FRAME) & 0x03) === 0x03; // BUG: proceed and skip inverted
}

test("TEETH (exhaustive): the sibling-arm twin and the polarity-inverted twin are CAUGHT", () => {
  const m = new Machine(ROM).clone();

  let siblingHit = null;
  for (let v = 0; v < 256 && !siblingHit; v++) {
    const want = runOracleBool(m, v);
    if (brokenSiblingArm(m) !== want) siblingHit = { v, want, got: brokenSiblingArm(m) };
  }
  assert.notEqual(siblingHit, null, "the exhaustive sweep FAILED to catch the sibling-arm twin — it proves nothing");
  assert.equal((siblingHit.v & 0x07), 0x03, "the sibling-arm twin must first diverge where FRAME & 7 == 3");

  let polarityHit = null;
  for (let v = 0; v < 256 && !polarityHit; v++) {
    const want = runOracleBool(m, v);
    if (brokenPolarity(m) !== want) polarityHit = { v, want, got: brokenPolarity(m) };
  }
  assert.notEqual(polarityHit, null, "the exhaustive sweep FAILED to catch the polarity twin — it proves nothing");

  console.log(
    `  TEETH/exhaustive: sibling-arm caught at FRAME=${hx(siblingHit.v)} (oracle=${siblingHit.want} broken=${siblingHit.got}); ` +
      `polarity caught at FRAME=${hx(polarityHit.v)} (oracle=${polarityHit.want} broken=${polarityHit.got})`,
  );
});

// -- 3. REALISM + PURITY (crafted entries) ------------------------------------

/** A real booted+attract machine so work RAM holds realistic values. */
function attractBase(frames = 180) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone(); // clone neutralises the frame machinery (nextNmi/nextBoundary = Infinity)
}

test("REALISM + PURITY (crafted): loc_3126 == oracle on real attract states with FRAME poked to both arms", () => {
  const base = attractBase();

  // Both arms plus high bytes to prove only the low two bits matter on a full machine.
  const frames = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x7b, 0x7f, 0xfb, 0xfc, 0xfe, 0xff];
  let proceed = 0;
  let skip = 0;
  for (const v of frames) {
    // Oracle on one fresh clone (PURITY: it must write no RAM); loc_3126 on another.
    const oc = base.clone();
    oc.mem.write8(FRAME, v);
    oc.regs.sp = SAFE_SP;
    const before = oc.dumpState();
    const want = oracle(oc);
    const after = oc.dumpState();
    const d = firstStateDiff(before, after, (off) => oc.stateOffsetToAddr(off));
    assert.equal(d, null, d && `oracle wrote RAM at 0x${(d.addr ?? 0).toString(16)} for FRAME=${hx(v)} — signature is not pure`);

    const cd = base.clone();
    cd.mem.write8(FRAME, v);
    cd.regs.sp = SAFE_SP;
    const got = loc_3126(cd);
    if (want) proceed++; else skip++;
    assert.equal(got, want, `crafted mismatch at FRAME=${hx(v)}: oracle=${want} loc_3126=${got}`);

    // And loc_3126 wrote no RAM either — the two full machines stay byte-identical.
    const ram = firstStateDiff(oc.dumpState(), cd.dumpState(), (off) => oc.stateOffsetToAddr(off));
    assert.equal(ram, null, ram && `RAM diverges at 0x${(ram.addr ?? 0).toString(16)} (${ram.a}->${ram.b}) for FRAME=${hx(v)}`);
  }
  console.log(`  REALISM/crafted: ${frames.length} real attract states (${proceed} proceed, ${skip} skip) — no RAM written, loc_3126 == oracle`);
});
