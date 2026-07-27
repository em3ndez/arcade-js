// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for applyDipSwitches (ROM 0x4b55) — the DIP-switch decode that
 * commits the cabinet settings into the gameplay-parameter block 0x804c..0x8053 (bonus/lives
 * pair, two counts, the difficulty step-timer base, the flip-screen / cocktail config and the
 * sprite coordinate bias) and drives the two flip-screen control lines.
 *
 * The routine's declared live-out is MEMORY-ONLY, so the gate compares OBSERVABLE RAM
 * (dumpState: work + colour + video + sprite RAM) and nothing else — not pc, SP, or the
 * value registers/flags the oracle threads through. Those are dead ABI here (no caller reads
 * them), and a strict pc/register contract would false-fail this register-free rewrite and
 * break the day the tail-jump callee is dissolved. This is the memory-equivalence contract
 * from equivalence-4c5f. (No stack-scratch exclusion is needed: the oracle's non-flip path
 * only pops a return address — it writes no stack byte — and this routine touches no stack.)
 *
 * The flip-screen control latch (0xb006/0xb007) is I/O, outside dumpState, so it never shows
 * in the RAM diff; the routine still drives it for the live game, and the decode that feeds it
 * (0x8050/0x8052/0x8051) IS observable and is checked.
 *
 * WHAT IS SWEPT. The decode is a pure function of the dip byte and the active-player byte
 * (0x8002), both of which the gate pokes on a real captured boot entry — the crafted-entry
 * method: a genuine state with a surgical nudge. Sweep A drives the dip byte across all 128
 * low-7-bit values (every decode branch) against representative player bytes; Sweep B drives
 * the player byte across all 256 values for each of the four flip-config combinations
 * (exhausting the dec/AND/XOR flip fold). The top dip bit (bit 7) diverts to a still-oracle
 * colour-test routine that only makes progress under the live frame loop, so that arm is equal
 * by construction (an identical m.call on both arms) and is not swept.
 *
 * Checks:
 *   0. HARNESS — capture a real 0x4b55 boot entry and confirm the oracle run is deterministic.
 *   1. EQUAL (real entry) — applyDipSwitches leaves the same RAM as the oracle, and the decoded
 *      block holds the expected default-cabinet values (DSW=0).
 *   2. EQUAL (dip sweep A) — every dip byte 0..127 against representative player bytes: RAM-equal.
 *   3. EQUAL (player sweep B) — every player byte 0..255 across the four flip configs: RAM-equal.
 *   4. TEETH (corrupted output) — a twin that flips the step-timer base byte is CAUGHT at 0x804f.
 *   5. TEETH (decode bug) — a twin that ignores the difficulty dip is CAUGHT during the sweep.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-4b55.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_4b55 as oracle } from "../../translated/loc_4b55.js";
import { applyDipSwitches as idiomatic } from "../applyDipSwitches.js";
import { makeMachineFactory } from "../../machine.js";
import { unitEquivalence, firstStateDiff } from "../../../../core/equivalence.js";
import { STEP_TIMER_BASE, SPRITE_COORD_BIAS, GAME_STATE2 } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x4b55;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is async, so
// build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

// -- helpers ------------------------------------------------------------------

/** Hook 0x4b55 in a real boot run and clone the machine at its first dispatch. */
function captureRealDipEntry(maxFrames) {
  let entry = null;
  const snapshot = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return oracle(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(maxFrames);
  return entry;
}

/** First differing observable-RAM byte between running the oracle and `fn` on clones of one
 *  entry; null when RAM-equal. Compares dumpState only — pc/SP/registers are excluded. */
function ramDiff(entry, fn) {
  const a = entry.clone();
  oracle(a);
  const b = entry.clone();
  fn(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** A real captured entry with the dip byte and active-player byte poked identically. */
function craft(seed, dsw, player) {
  const e = seed.clone();
  e.io.dsw = dsw;
  e.mem.write8(GAME_STATE2, player);
  return e;
}

// -- 0. HARNESS ---------------------------------------------------------------

test("HARNESS: a real 0x4b55 boot entry is captured and the oracle run is deterministic", () => {
  const entry = captureRealDipEntry(400);
  assert.ok(entry, "expected 0x4b55 to be dispatched during boot");

  const a = entry.clone();
  oracle(a);
  const b = entry.clone();
  oracle(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `oracle run not deterministic: diff at ${hx(d.addr ?? 0)}`);
  console.log(
    `  HARNESS: captured a real 0x4b55 entry (DSW=${hx(entry.io.dsw)}, ` +
      `player=${entry.mem.read8(GAME_STATE2)}); oracle run deterministic`,
  );
});

// -- 1. EQUAL on the real captured boot entry --------------------------------

test("EQUAL (real entry): applyDipSwitches == oracle over observable RAM", () => {
  // unitEquivalence captures 0x4b55's first boot dispatch and runs oracle vs idiomatic. Its
  // register/pc fields are the dead ABI this rewrite deliberately drops (honest signature), so
  // only its RAM diff is asserted — that is the memory-equivalence contract.
  const res = unitEquivalence(makeMachine, TARGET, oracle, idiomatic, { maxFrames: 400 });
  assert.equal(res.ram, null, res.ram && `RAM diff at ${hx(res.ram.addr ?? 0)} oracle=${res.ram.a} cand=${res.ram.b}`);

  // Positive check: the default cabinet (DSW=0) decodes to the expected parameter block.
  const entry = captureRealDipEntry(400);
  const c = entry.clone();
  idiomatic(c);
  assert.equal(c.mem.read8(0x804c), 0x01, "bonus/lives low byte");
  assert.equal(c.mem.read8(0x804d), 0x02, "bonus/lives high byte");
  assert.equal(c.mem.read8(0x804e), 10, "count from bit 2");
  assert.equal(c.mem.read8(STEP_TIMER_BASE), 55, "difficulty step-timer base (bit 3 clear)");
  assert.equal(c.mem.read8(0x8050), 0, "flip-invert flag");
  assert.equal(c.mem.read8(0x8052), 0, "flip-follows-player flag");
  assert.equal(c.mem.read8(SPRITE_COORD_BIAS), 0, "sprite coordinate bias (upright)");
  assert.equal(c.mem.read8(0x8053), 3, "count from bit 6");
  console.log("  EQUAL/real: identical observable RAM; DSW=0 decodes to the default-cabinet block");
});

// -- 2. EQUAL across dip byte 0..127 (every decode branch) -------------------

test("EQUAL (dip sweep A): every dip byte 0..127 leaves identical RAM", () => {
  const seed = captureRealDipEntry(400);
  assert.ok(seed, "need a captured entry to sweep from");

  const players = [0, 1, 2, 3, 4, 127, 128, 254, 255]; // dec-wrap + parity + high values
  let cases = 0;
  for (let dsw = 0; dsw < 128; dsw++) {
    for (const player of players) {
      const d = ramDiff(craft(seed, dsw, player), idiomatic);
      assert.equal(d, null, d && `DSW=${hx(dsw)} player=${player}: RAM diff at ${hx(d.addr ?? 0)} oracle=${d.a} cand=${d.b}`);
      cases++;
    }
  }
  console.log(`  EQUAL/dipsweep: ${cases} (dip, player) cases across dip 0..127 all RAM-equal`);
});

// -- 3. EQUAL across player byte 0..255 for every flip config -----------------

test("EQUAL (player sweep B): every player byte 0..255 across the four flip configs is identical", () => {
  const seed = captureRealDipEntry(400);
  assert.ok(seed, "need a captured entry to sweep from");

  const flipConfigs = [0x00, 0x10, 0x20, 0x30]; // none / invert / follow / follow+invert
  let cases = 0;
  for (const dsw of flipConfigs) {
    for (let player = 0; player < 256; player++) {
      const d = ramDiff(craft(seed, dsw, player), idiomatic);
      assert.equal(d, null, d && `DSW=${hx(dsw)} player=${player}: RAM diff at ${hx(d.addr ?? 0)} oracle=${d.a} cand=${d.b}`);
      cases++;
    }
  }
  console.log(`  EQUAL/playersweep: ${cases} (flip-config, player) cases all RAM-equal (dec/AND/XOR fold exhausted)`);
});

// -- 4. TEETH: a corrupted output byte is caught -----------------------------

/** Broken twin: the correct decode, then one wrong store to the step-timer base. */
function twinCorruptTimerBase(m) {
  idiomatic(m);
  m.mem.write8(STEP_TIMER_BASE, m.mem.read8(STEP_TIMER_BASE) ^ 0xff);
}

test("TEETH (corrupted output): a wrong step-timer-base store is CAUGHT at 0x804f", () => {
  const entry = captureRealDipEntry(400);
  assert.ok(entry, "need a captured entry to seed the teeth check");

  const d = ramDiff(entry, twinCorruptTimerBase);
  assert.ok(d, "the gate FAILED to catch a corrupted output byte — it proves nothing");
  assert.equal(d.addr, STEP_TIMER_BASE, `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(STEP_TIMER_BASE)})`);
  console.log(`  TEETH/output: corrupted step-timer base caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

// -- 5. TEETH: a decode-logic bug is caught during the sweep -----------------

/** Broken twin: ignores the difficulty dip (bit 3), always writing the slow base 55. */
function twinIgnoreDifficultyDip(m) {
  idiomatic(m);
  m.mem.write8(STEP_TIMER_BASE, 55); // BUG: drops the bit-3 -> 45 adjustment
}

test("TEETH (decode bug): ignoring the difficulty dip is CAUGHT when bit 3 is set", () => {
  const seed = captureRealDipEntry(400);
  assert.ok(seed, "need a captured entry to seed the teeth check");

  // Bit 3 set -> oracle writes 45; the twin writes 55.
  const d = ramDiff(craft(seed, 0x08, 1), twinIgnoreDifficultyDip);
  assert.ok(d, "the gate FAILED to catch the decode bug — it proves nothing");
  assert.equal(d.addr, STEP_TIMER_BASE, `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(STEP_TIMER_BASE)})`);
  assert.equal(d.a, 45, "oracle should write the fast base 45 when bit 3 is set");
  assert.equal(d.b, 55, "twin wrote the slow base 55");
  console.log(`  TEETH/decode: difficulty-dip decode bug caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
