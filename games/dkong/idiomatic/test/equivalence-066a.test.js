// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for renderBonusDisplay (ROM 0x066A) — render a packed two-digit BCD byte into its
 * on-screen field, suppressing a leading zero.
 *
 * renderBonusDisplay's entire memory effect is a PURE FUNCTION of the digit byte it receives in a
 * register: it reads no work RAM, and writes a fixed set of cells (SND_BGM 0x6089 and the
 * field's video cells) whose values derive only from that byte. So an EXHAUSTIVE gate is
 * available — sweeping all 256 byte values on a real captured base covers the whole input
 * space, a proof rather than a sample. Attract only ever reaches the tens-digit-nonzero arm
 * (board readouts 0x36..0x50), so the sweep is what exercises the leading-zero-suppress arm
 * (tens nibble 0, byte 0x00..0x0F).
 *
 * The oracle's tail (loc_0689) `ret`s without a matching push — the join into it is a
 * fallthrough — so the oracle only POPS the stack; it writes no stack bytes. The idiomatic
 * routine drops that ret (the JS call stack replaces it). Neither side writes the stack, so
 * there is no dissolved push and NO STACK_SCRATCH to exclude: the contract is the whole RAM
 * dump. Live-out is memory-only, so pc/SP are not compared.
 *
 *   1. EQUAL (exhaustive) — renderBonusDisplay == oracle over the whole RAM dump for all 256 input
 *      bytes on a real captured base (both arms).
 *   2. EQUAL (real captured dispatches) — hook 0x066A in a real attract run, clone at each
 *      true dispatch (the task-10 field render), and confirm identical over real bases.
 *   3. TEETH (exhaustive) — three deliberately-broken twins, each of which the same sweep
 *      MUST catch, each on a genuine live-out cell:
 *        (a) dropped SND_BGM latch — caught on a suppress-arm input at SND_BGM (0x6089).
 *        (b) swapped digit pair — caught on a tens!=units input in the field's video cells.
 *        (c) wrong units-tile offset (units instead of 0x70+units) — caught on a suppress-arm
 *            input at the low field cell (0x74C6).
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-066a.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_066a as oracle } from "../../translated/loc_066a.js";
import { renderBonusDisplay } from "../renderBonusDisplay.js";
import { stampTwoDigitField } from "../stampTwoDigitField.js";
import { SND_BGM } from "../names.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x066a;
const LOW_FIELD_CELL = 0x74c6; // the tail's low (units) cell — a video-RAM live-out
const hx = (v) => "0x" + (v & 0xffff).toString(16);
const hb = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

// -- capture ------------------------------------------------------------------

/** Hook 0x066A in a real attract run and clone the machine at up to K real dispatches. */
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
 * A synthetic entry: a clone of `base` with the incoming digit byte set and the frame
 * machinery neutralised (clone() already sets nextNmi/nextBoundary = Infinity; re-asserted
 * for clarity) so the oracle's `m.step` cannot fire an NMI or push a frame in isolation.
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

// -- 0. reachability ----------------------------------------------------------

test("REACHABILITY: 0x066A is dispatched during attract", () => {
  const caps = captureDispatches(500, 2500);
  assert.ok(caps.length >= 1, "expected at least one real 0x066A dispatch — the task-10 field render");
  const shapes = [...new Set(caps.map((c) => hb(c.regs.a)))].sort();
  console.log(`  REACHABILITY: ${caps.length} natural 0x066A dispatches; input bytes seen: ${shapes.join(", ")}`);
});

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): renderBonusDisplay == oracle over all 256 input bytes (both arms)", () => {
  const [base] = captureDispatches(1, 1500);
  assert.ok(base, "need one real capture to sweep from");
  const { mismatch, count } = fullSweep(base, renderBonusDisplay);
  assert.equal(mismatch, null, describe(mismatch));
  assert.equal(count, 256, "must have compared the full 256-byte input space");
  // 16 suppress-arm bytes (0x00..0x0F) + 240 tens-nonzero — the whole space, both arms.
  console.log(`  EQUAL/exhaustive: ${count} input bytes — RAM identical to the oracle (16 suppress-arm, 240 leading-digit)`);
});

// -- 2. EQUAL (real captured dispatches) --------------------------------------

test("EQUAL (real dispatches): renderBonusDisplay == oracle on every captured 0x066A entry", () => {
  const caps = captureDispatches(256, 2500);
  assert.ok(caps.length >= 1, "expected at least one real 0x066A dispatch during attract");
  for (const cap of caps) {
    const a = cap.clone(); a.nextNmi = Infinity; a.nextBoundary = Infinity;
    const b = cap.clone(); b.nextNmi = Infinity; b.nextBoundary = Infinity;
    const inByte = a.regs.a & 0xff;
    oracle(a);
    renderBonusDisplay(b);
    const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(ram, null, ram && `real dispatch input=${hb(inByte)}: RAM diverges at ${hx(ram.addr ?? 0)} (${ram.a}->${ram.b})`);
  }
  console.log(`  EQUAL/real: ${caps.length} captured dispatches identical to the oracle`);
});

// -- 3. TEETH (exhaustive) ----------------------------------------------------

/** BUG (a): drops the SND_BGM latch on the leading-zero-suppress arm. */
function brokenDroppedBgm(m) {
  const { regs, mem } = m;
  const unitsDigit = regs.a & 0x0f;
  const tensDigit = (regs.a >> 4) & 0x0f;
  if (tensDigit !== 0) { regs.a = tensDigit; regs.b = unitsDigit; stampTwoDigitField(m); return; }
  // BUG: the `mem.write8(SND_BGM, 0x03)` is missing.
  mem.write8(0x7486, 0x70);
  mem.write8(0x74a6, 0x70);
  regs.a = 0x10;
  regs.b = 0x70 + unitsDigit;
  stampTwoDigitField(m);
}

/** BUG (b): swaps the two digit tiles on the leading-digit arm. */
function brokenSwappedDigits(m) {
  const { regs, mem } = m;
  const unitsDigit = regs.a & 0x0f;
  const tensDigit = (regs.a >> 4) & 0x0f;
  if (tensDigit !== 0) { regs.a = unitsDigit; regs.b = tensDigit; stampTwoDigitField(m); return; } // BUG: swapped
  mem.write8(SND_BGM, 0x03);
  mem.write8(0x7486, 0x70);
  mem.write8(0x74a6, 0x70);
  regs.a = 0x10;
  regs.b = 0x70 + unitsDigit;
  stampTwoDigitField(m);
}

/** BUG (c): drops the 0x70 tile-row offset on the suppressed units digit. */
function brokenUnitsOffset(m) {
  const { regs, mem } = m;
  const unitsDigit = regs.a & 0x0f;
  const tensDigit = (regs.a >> 4) & 0x0f;
  if (tensDigit !== 0) { regs.a = tensDigit; regs.b = unitsDigit; stampTwoDigitField(m); return; }
  mem.write8(SND_BGM, 0x03);
  mem.write8(0x7486, 0x70);
  mem.write8(0x74a6, 0x70);
  regs.a = 0x10;
  regs.b = unitsDigit; // BUG: should be 0x70 + unitsDigit
  stampTwoDigitField(m);
}

test("TEETH (exhaustive): dropped-SND_BGM, swapped-digits, and wrong-units-offset twins are CAUGHT", () => {
  const [cap] = captureDispatches(1, 1500);
  assert.ok(cap, "need one real capture to sweep from");
  // Pin SND_BGM to a non-0x03 sentinel so the dropped-latch twin is reliably observable on
  // the suppress arm (identical on both sides — it is the shared base).
  const base = cap.clone();
  base.mem.write8(SND_BGM, 0x00);

  const droppedBgm = fullSweep(base, brokenDroppedBgm).mismatch;
  assert.notEqual(droppedBgm, null, "the sweep FAILED to catch a dropped SND_BGM latch — worthless");
  assert.equal(droppedBgm.ram.addr, SND_BGM, `the dropped-latch twin must diverge on SND_BGM, got ${hx(droppedBgm.ram.addr ?? 0)}`);

  const swapped = fullSweep(base, brokenSwappedDigits).mismatch;
  assert.notEqual(swapped, null, "the sweep FAILED to catch a swapped digit pair — worthless");
  assert.ok((swapped.ram.addr & 0xff00) === 0x7400, `the swapped-digit twin must diverge in the field's video RAM, got ${hx(swapped.ram.addr ?? 0)}`);

  const offset = fullSweep(base, brokenUnitsOffset).mismatch;
  assert.notEqual(offset, null, "the sweep FAILED to catch a wrong units-tile offset — worthless");
  assert.equal(offset.ram.addr, LOW_FIELD_CELL, `the wrong-offset twin must diverge on the low field cell, got ${hx(offset.ram.addr ?? 0)}`);

  console.log(`  TEETH: dropped-SND_BGM caught (${describe(droppedBgm)}); swapped-digits caught (${describe(swapped)}); wrong-offset caught (${describe(offset)})`);
});
