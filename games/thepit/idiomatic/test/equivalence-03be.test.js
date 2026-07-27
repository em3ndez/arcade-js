// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for enterPlayMode (ROM 0x03be) — the "start playing" arm of
 * the top-level state dispatcher: it flips the game-mode byte to the play value, seeds
 * the per-round counters (demo steering heading, gameplay-tick phase countdown/index,
 * idle-delay base, a per-round counter), mutes audio + commits the DIP settings via two
 * setup calls, then tail-jumps into the round (re)init.
 *
 * The routine's declared live-out is MEMORY-ONLY, so the gate compares OBSERVABLE RAM
 * (dumpState: work + colour + video + sprite RAM) and nothing else — not pc, SP, or the
 * value registers the oracle threads through. Those are dead ABI (the round init it hands
 * off to reads none of them), and a strict pc/register contract would false-fail this
 * register-free rewrite. This is the memory-equivalence contract from equivalence-4b55.
 *
 * TWO WRINKLES this routine adds over a plain leaf:
 *
 *  1. IT NEVER RETURNS. Its tail-jump lands in the round init, which falls through into
 *     the main game loop and spins forever — so running it to completion on a clone (whose
 *     frame machinery is neutralised, so no NMI breaks the spin) would hang. The tail
 *     target 0x031a has no idiomatic form, so BOTH the oracle and the rewrite reach it the
 *     same way (m.call(0x031a)); the gate stubs 0x031a to a no-op on both clones, stopping
 *     each exactly at the tail boundary. That is "equal by construction" for the shared
 *     tail — the same identical call on both arms — and lets the diff measure only the
 *     work this routine does before it.
 *
 *  2. STACK SCRATCH. The oracle path pushes a return address for each of its two setup
 *     calls (into the two bytes just below the entry stack pointer, 0x83fd..0x83fe) and the
 *     oracle callees pop them; the stack-free idiomatic JS calls disableSound /
 *     applyDipSwitches directly and pushes nothing, so those two bytes differ as classic
 *     dead stack scratch (overwritten by the next push before anything reads them). The RAM
 *     diff excludes exactly that [SP-2, SP) window and compares everything else byte-for-byte.
 *
 * Checks:
 *   0. HARNESS — capture a real 0x03be dispatch and confirm the oracle run is deterministic.
 *   1. EQUAL (real entry) — enterPlayMode leaves the same observable RAM as the oracle, and
 *      the seeded cells hold the expected play-mode values.
 *   2. EQUAL (DIP sweep 0..127) — for every normal DIP setting (top bit clear) the two agree,
 *      proving the delegation to disableSound + applyDipSwitches matches across the whole decode.
 *   3. EQUAL (garbage prefill) — with every seeded cell pre-filled with arbitrary values on
 *      both sides, the two still agree: the seeds are UNCONDITIONAL, not prior-state dependent.
 *   4. TEETH (wrong play value) — a twin that writes game-mode 5 instead of 4 is CAUGHT at the
 *      game-mode byte (the store that actually enters play).
 *   5. TEETH (dropped seed) — a twin that fails to seed the phase countdown is CAUGHT at 0x800b.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-03be.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_03be as oracle } from "../../translated/loc_03be.js";
import { enterPlayMode as idiomatic } from "../enterPlayMode.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { GAME_MODE, DEMO_STEER_DIR, GAME_STATE2 } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x03be;
const TAIL = 0x031a; // the round-init tail-jump target (no idiomatic form; spins forever)
const CAPTURE_FRAMES = 900; // 0x03be is first dispatched ~frame 693 as attract enters the demo
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is async, so
// build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/** Hook 0x03be in a real boot/attract run and clone the machine at its first dispatch. */
function captureRealEntry(maxFrames) {
  let entry = null;
  const snapshot = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return oracle(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return entry;
}

/** Run `fn` on a fresh clone of `entry` with the round-init tail-jump stubbed to a no-op,
 *  so execution stops at the tail boundary instead of spinning in the main loop. */
function runArm(entry, fn) {
  const c = entry.clone();
  c.routines.set(TAIL, () => {}); // bound the shared tail-jump on both arms
  fn(c);
  return c;
}

/** First differing observable-RAM byte between the oracle and `fn` on clones of one entry,
 *  EXCLUDING the two dead stack-scratch bytes just below the entry stack pointer (the return
 *  addresses the oracle's setup calls park there; the stack-free rewrite does not). Null when
 *  otherwise identical. */
function ramDiff(entry, fn) {
  const sp = entry.regs.sp;
  const a = runArm(entry, oracle);
  const b = runArm(entry, fn);
  const da = a.dumpState();
  const db = b.dumpState();
  const n = Math.min(da.length, db.length);
  for (let i = 0; i < n; i++) {
    if (da[i] === db[i]) continue;
    const addr = a.stateOffsetToAddr(i);
    if (addr >= sp - 2 && addr < sp) continue; // dead stack scratch
    return { addr, a: da[i], b: db[i] };
  }
  return null;
}

/** A real captured entry with the cabinet DIP byte poked identically on both sides. */
function craftDip(seed, dsw) {
  const e = seed.clone();
  e.io.dsw = dsw;
  return e;
}

// -- 0. HARNESS (reachability + determinism) ---------------------------------

test("HARNESS: a real 0x03be dispatch is captured and the oracle run is deterministic", () => {
  const entry = captureRealEntry(CAPTURE_FRAMES);
  assert.ok(entry, "expected 0x03be to be dispatched during boot/attract");

  const a = runArm(entry, oracle);
  const b = runArm(entry, oracle);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `oracle run not deterministic: diff at ${hx(d.addr ?? 0)}`);
  console.log(
    `  HARNESS: captured a real 0x03be entry (SP=${hx(entry.regs.sp)}, DSW=${hx(entry.io.dsw)}); ` +
      "oracle run of enterPlayMode deterministic",
  );
});

// -- 1. EQUAL on the real captured entry -------------------------------------

test("EQUAL (real entry): enterPlayMode == oracle over observable RAM", () => {
  const entry = captureRealEntry(CAPTURE_FRAMES);
  assert.ok(entry, "need a captured 0x03be entry");

  const d = ramDiff(entry, idiomatic);
  assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)} oracle=${d.a} cand=${d.b}`);

  // Positive check: the seeded cells hold the play-mode values.
  const c = runArm(entry, idiomatic);
  assert.equal(c.mem8[GAME_MODE], 4, "game-mode byte = play value");
  assert.equal(c.mem8[DEMO_STEER_DIR], 1, "demo steering heading seeded");
  assert.equal(c.mem8[GAME_STATE2], 1, "secondary game-state armed");
  assert.equal(c.mem8[0x8029], 3, "per-round counter seeded");
  assert.equal(c.mem8[0x804e], 12, "idle-delay base (overrides the DIP decode)");
  assert.equal(c.mem8[0x800b], 1, "gameplay-tick phase countdown");
  assert.equal(c.mem8[0x800c], 0, "gameplay-tick phase index reset");
  console.log("  EQUAL/real: identical observable RAM; seeds hold the play-mode values");
});

// -- 2. EQUAL across every normal DIP setting --------------------------------

test("EQUAL (DIP sweep 0..127): every normal DIP setting leaves identical RAM", () => {
  const seed = captureRealEntry(CAPTURE_FRAMES);
  assert.ok(seed, "need a captured entry to sweep from");

  let cases = 0;
  for (let dsw = 0; dsw < 128; dsw++) { // top bit clear: avoid the colour-test diversion
    const d = ramDiff(craftDip(seed, dsw), idiomatic);
    assert.equal(d, null, d && `DSW=${hx(dsw)}: RAM diff at ${hx(d.addr ?? 0)} oracle=${d.a} cand=${d.b}`);
    cases++;
  }
  console.log(`  EQUAL/dipsweep: ${cases} DIP settings 0..127 all RAM-equal (delegation matches the decode)`);
});

// -- 3. EQUAL with every seeded cell pre-filled with garbage ------------------

test("EQUAL (garbage prefill): the seeds are unconditional, not prior-state dependent", () => {
  const seed = captureRealEntry(CAPTURE_FRAMES);
  assert.ok(seed, "need a captured entry");

  // Pre-fill the cells this routine seeds (and a few it does NOT touch) with arbitrary
  // values, identically on both sides. If the seeds are unconditional the two runs still
  // converge; a cell the routine leaves alone stays equal because both keep the garbage.
  const e = seed.clone();
  for (const [addr, val] of [
    [GAME_MODE, 0x55], [DEMO_STEER_DIR, 0x55], [GAME_STATE2, 0x55], [0x8029, 0x55],
    [0x804c, 0xaa], [0x804d, 0xaa], [0x804e, 0xaa], [0x804f, 0xaa],
    [0x8050, 0xaa], [0x8051, 0xaa], [0x8052, 0xaa], [0x8053, 0xaa],
    [0x800b, 0xaa], [0x800c, 0xaa],
  ]) {
    e.mem8[addr] = val;
  }
  const d = ramDiff(e, idiomatic);
  assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)} oracle=${d.a} cand=${d.b}`);
  console.log("  EQUAL/garbage: unconditional seeds converge from an arbitrary prefill");
});

// -- 4. TEETH: a wrong play value is caught ----------------------------------

/** Broken twin: writes game-mode 5 instead of 4 — the machine would never enter play. */
function twinWrongPlayValue(m) {
  idiomatic(m);
  m.mem8[GAME_MODE] = 5;
}

test("TEETH (wrong play value): game-mode 5 instead of 4 is CAUGHT at the game-mode byte", () => {
  const entry = captureRealEntry(CAPTURE_FRAMES);
  assert.ok(entry, "need a captured entry to seed the teeth check");

  const d = ramDiff(entry, twinWrongPlayValue);
  assert.ok(d, "the gate FAILED to catch a wrong play value — it proves nothing");
  assert.equal(d.addr, GAME_MODE, `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(GAME_MODE)})`);
  assert.equal(d.a, 4, "oracle enters play with game-mode 4");
  assert.equal(d.b, 5, "twin wrote the wrong value 5");
  console.log(`  TEETH/playvalue: wrong game-mode caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

// -- 5. TEETH: a dropped seed is caught --------------------------------------

/** Broken twin: fails to seed the gameplay-tick phase countdown (leaves it 0). */
function twinDropPhaseCountdown(m) {
  idiomatic(m);
  m.mem8[0x800b] = 0; // BUG: countdown never seeded
}

test("TEETH (dropped seed): a missing phase-countdown seed is CAUGHT at 0x800b", () => {
  const entry = captureRealEntry(CAPTURE_FRAMES);
  assert.ok(entry, "need a captured entry to seed the teeth check");

  const d = ramDiff(entry, twinDropPhaseCountdown);
  assert.ok(d, "the gate FAILED to catch a dropped seed — it proves nothing");
  assert.equal(d.addr, 0x800b, `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected 0x800b)`);
  assert.equal(d.a, 1, "oracle seeds the phase countdown to 1");
  assert.equal(d.b, 0, "twin left it unseeded");
  console.log(`  TEETH/dropseed: dropped phase-countdown seed caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
