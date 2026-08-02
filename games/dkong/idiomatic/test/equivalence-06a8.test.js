// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_06a8 (ROM 0x06A8) — decrement the packed two-digit BCD bonus
 * readout BONUS_DISPLAY by one, latch a "reached zero" marker when it rolls to 00, store it
 * back, and render it.
 *
 * loc_06a8's entire memory effect is a PURE FUNCTION of the counter byte it receives in a
 * register: it reads no work RAM, and its render tail (loc_066a -> stampTwoDigitField) reads
 * none either. Every cell it touches (BONUS_DISPLAY_ZEROED, BONUS_DISPLAY, the
 * background-music command, and the field's video cells) derives only from that byte. So an
 * EXHAUSTIVE gate is available — sweeping all 256 byte values on a real captured base covers
 * the whole input space, a proof rather than a sample. The caller (entry_062a) only reaches
 * this arm with a non-zero counter, so the sweep is what also exercises the zero-latch edge
 * (input 0x01, which decrements to 0x00) and the 00->99 wrap (input 0x00).
 *
 * The oracle's tail is `jp 0x066a` (nothing pushed), and the only `ret` in the whole chain
 * (stampTwoDigitField) merely POPS the stack — it writes no stack bytes. The idiomatic routine
 * drops that ret (the JS call stack replaces it). Neither side writes the stack, so there is no
 * dissolved push and NO STACK_SCRATCH to exclude: the contract is the whole RAM dump. Live-out
 * is memory-only, so pc/SP are not compared.
 *
 *   1. EQUAL (exhaustive) — loc_06a8 == oracle over the whole RAM dump for all 256 input bytes
 *      on a real captured base (both the zero-latch arm and the ordinary-decrement arm).
 *   2. EQUAL (real captured dispatches) — hook 0x06A8 in a real attract run, clone at each true
 *      dispatch (task-10's counter step), and confirm identical over real bases.
 *   3. TEETH (exhaustive) — three deliberately-broken twins, each of which the same sweep MUST
 *      catch, each on a genuine live-out cell:
 *        (a) dropped decimal-adjust — caught at BONUS_DISPLAY.
 *        (b) dropped zero latch — caught at BONUS_DISPLAY_ZEROED on input 0x01.
 *        (c) always-latch (drops the zero condition) — caught at BONUS_DISPLAY_ZEROED on a
 *            non-01 input.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-06a8.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { BONUS_DISPLAY, BONUS_DISPLAY_ZEROED } from "../ram.js";
import { loc_06a8 as oracle } from "../../translated/loc_06a8.js";
import { loc_06a8 } from "../loc_06a8.js";
import { loc_066a } from "../loc_066a.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x06a8;
const hx = (v) => "0x" + (v & 0xffff).toString(16);
const hb = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

// -- capture ------------------------------------------------------------------

/** Hook 0x06A8 in a real attract run and clone the machine at up to K real dispatches. */
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

// -- the exhaustive sweep -----------------------------------------------------

/**
 * A synthetic entry: a clone of `base` with the incoming counter byte set and the frame
 * machinery neutralised (clone() already sets nextNmi/nextBoundary = Infinity; re-asserted for
 * clarity) so the oracle's `m.step` cannot fire an NMI or push a frame in isolation.
 */
function makeEntry(base, byte) {
  const e = base.clone();
  e.regs.a = byte & 0xff;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and a candidate on two FRESH, byte-identical entries and diff the whole RAM
 * dump (memory-equivalence contract; neither side writes the stack, so no exclusion). A fresh
 * entry per side because the routine WRITES memory.
 */
function runPair(base, byte, candidate) {
  const a = makeEntry(base, byte); // oracle
  const b = makeEntry(base, byte); // candidate
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** Sweep all 256 input bytes; return the first mismatch (or null) and the count compared. */
function fullSweep(base, candidate) {
  for (let v = 0; v < 256; v++) {
    const ram = runPair(base, v, candidate);
    if (ram) return { mismatch: { v, ram }, count: v + 1 };
  }
  return { mismatch: null, count: 256 };
}

const describe = (mm) =>
  mm && `at input=${hb(mm.v)}: RAM diverges at ${hx(mm.ram.addr ?? 0)} (${mm.ram.a}->${mm.ram.b})`;

// A real, self-consistent machine: boot + a stretch of attract so work RAM holds realistic
// values to sweep the counter byte against. Used when no natural 0x06A8 dispatch is captured.
function attractBase(frames = 600) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone(); // clone neutralises the frame machinery (nextNmi/nextBoundary = Infinity)
}

// -- 0. reachability ----------------------------------------------------------

test("REACHABILITY: 0x06A8 is dispatched during boot/attract", () => {
  const caps = captureDispatches(500, 2500);
  console.log(`  REACHABILITY: ${caps.length} natural 0x06A8 dispatches in 2500 frames`);
  if (caps.length) {
    const shapes = [...new Set(caps.map((c) => hb(c.regs.a)))].sort();
    console.log(`  counter bytes seen: ${shapes.join(", ")}`);
  }
});

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): loc_06a8 == oracle over all 256 counter bytes (both arms)", () => {
  const [cap] = captureDispatches(1, 2500);
  const base = cap ?? attractBase();
  const { mismatch, count } = fullSweep(base, loc_06a8);
  assert.equal(mismatch, null, describe(mismatch));
  assert.equal(count, 256, "must have compared the full 256-byte input space");
  console.log(`  EQUAL/exhaustive: ${count} counter bytes — RAM identical to the oracle` +
    `${cap ? " (base = real 0x06A8 capture)" : " (base = attract)"}`);
});

// -- 2. EQUAL (real captured dispatches) --------------------------------------

test("EQUAL (real dispatches): loc_06a8 == oracle on every captured 0x06A8 entry", (t) => {
  const caps = captureDispatches(256, 2500);
  if (caps.length === 0) {
    // 0x06A8 fires only once the task-10 counter has been seeded and then stepped; a short
    // attract may not reach it. The exhaustive sweep above is the proof either way.
    t.skip("no natural 0x06A8 dispatch captured in 2500 frames — exhaustive sweep covers it");
    return;
  }
  for (const cap of caps) {
    const a = cap.clone(); a.nextNmi = Infinity; a.nextBoundary = Infinity;
    const b = cap.clone(); b.nextNmi = Infinity; b.nextBoundary = Infinity;
    const inByte = a.regs.a & 0xff;
    oracle(a);
    loc_06a8(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(ram, null, ram && `real dispatch input=${hb(inByte)}: RAM diverges at ${hx(ram.addr ?? 0)} (${ram.a}->${ram.b})`);
  }
  console.log(`  EQUAL/real: ${caps.length} captured dispatches identical to the oracle`);
});

// -- 3. TEETH (exhaustive) ----------------------------------------------------

/** BUG (a): skips the decimal adjust, so the stored counter is the raw subtracted byte. */
function brokenNoDaa(m) {
  const { regs, mem } = m;
  regs.sub(0x01);
  if (regs.a === 0) mem.write8(BONUS_DISPLAY_ZEROED, 0x01);
  // BUG: the `regs.daa()` is missing.
  mem.write8(BONUS_DISPLAY, regs.a);
  loc_066a(m);
}

/** BUG (b): never latches the zero marker. */
function brokenNoLatch(m) {
  const { regs, mem } = m;
  regs.sub(0x01);
  // BUG: the `if (regs.a === 0) mem.write8(BONUS_DISPLAY_ZEROED, 0x01)` is missing.
  regs.daa();
  mem.write8(BONUS_DISPLAY, regs.a);
  loc_066a(m);
}

/** BUG (c): latches the zero marker unconditionally (drops the reached-zero test). */
function brokenAlwaysLatch(m) {
  const { regs, mem } = m;
  regs.sub(0x01);
  mem.write8(BONUS_DISPLAY_ZEROED, 0x01); // BUG: always latches, not only when the counter hit zero
  regs.daa();
  mem.write8(BONUS_DISPLAY, regs.a);
  loc_066a(m);
}

test("TEETH (exhaustive): dropped-daa, dropped-latch, and always-latch twins are CAUGHT", () => {
  const [cap] = captureDispatches(1, 2500);
  const src = cap ?? attractBase();
  // Pin the zero marker to a non-1 sentinel so the latch twins are reliably observable
  // (identical on both sides — it is the shared base).
  const base = src.clone();
  base.mem.write8(BONUS_DISPLAY_ZEROED, 0x00);

  const noDaa = fullSweep(base, brokenNoDaa).mismatch;
  assert.notEqual(noDaa, null, "the sweep FAILED to catch a dropped decimal adjust — worthless");
  assert.equal(noDaa.ram.addr, BONUS_DISPLAY, `the dropped-daa twin must diverge on BONUS_DISPLAY, got ${hx(noDaa.ram.addr ?? 0)}`);

  const noLatch = fullSweep(base, brokenNoLatch).mismatch;
  assert.notEqual(noLatch, null, "the sweep FAILED to catch a dropped zero latch — worthless");
  assert.equal(noLatch.ram.addr, BONUS_DISPLAY_ZEROED, `the dropped-latch twin must diverge on BONUS_DISPLAY_ZEROED, got ${hx(noLatch.ram.addr ?? 0)}`);
  assert.equal(noLatch.v, 0x01, `the dropped-latch twin should first diverge on input 0x01, got ${hb(noLatch.v)}`);

  const alwaysLatch = fullSweep(base, brokenAlwaysLatch).mismatch;
  assert.notEqual(alwaysLatch, null, "the sweep FAILED to catch an always-latch twin — worthless");
  assert.equal(alwaysLatch.ram.addr, BONUS_DISPLAY_ZEROED, `the always-latch twin must diverge on BONUS_DISPLAY_ZEROED, got ${hx(alwaysLatch.ram.addr ?? 0)}`);

  console.log(`  TEETH: dropped-daa caught (${describe(noDaa)}); dropped-latch caught (${describe(noLatch)}); always-latch caught (${describe(alwaysLatch)})`);
});
