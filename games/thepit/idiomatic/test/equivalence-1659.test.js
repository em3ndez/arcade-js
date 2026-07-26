// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence gate for loc_1659 (ROM 0x1659) — the tile-under-object classifier's
 * open-ground animation step: it re-expresses the object's column (0x8068) as an
 * offset from the reference point (0x806c), reads an 8-step walk phase off that
 * offset, sets the motion marker (0x8075) and the alternating sprite frame
 * (SPRITE_CODE), then tail-calls the record builder loc_1b5b.
 *
 * Two things make this gate wider than loc_1b5b's memory-only one:
 *   - It has a genuine REGISTER live-out. The oracle leaves the walk phase in E, and
 *     loc_1b5b (which this routine tail-calls) never touches E, so E survives to the
 *     classifier's caller. The gate therefore compares the full register file too
 *     (firstRegDiff), not just the state dump — an honest rewrite must reproduce E.
 *     loc_1b5b restores A/F/B/HL from memory identically on both arms, so those dead
 *     residuals do not false-fail here (verified: oracle-vs-oracle regs diff is null).
 *   - Attract never digs a moving object onto open ground, so 0x1659 is NOT dispatched
 *     naturally (measured: 0 dispatches in 1200 frames). This is the CRAFTED-ENTRY
 *     path — the routine reads only work RAM, so any real attract clone with its two
 *     inputs poked is a valid entry, and the object logic depends only on
 *     (column - reference) mod 256, which the sweep covers over all 256 offsets.
 *
 * FIVE checks:
 *   1. EQUAL (real captured attract states) — clone the running attract machine at a
 *      spread of frames (genuine in-play RAM) and confirm state AND registers match
 *      the oracle. Proves it on real machine states, not just poked ones.
 *   2. EQUAL (offset sweep) — poke column/reference across all 256 offsets (every walk
 *      phase, the rest-point and moving branches, and the byte-wrap edge), identically
 *      on both arms; state and registers must match. This is the airtight evidence.
 *   3. NON-VACUOUS — pre-set the outputs (column, marker, sprite) and E to sentinels,
 *      then confirm every one is overwritten and both arms agree — a no-op twin cannot
 *      pass by the entry already holding the answer.
 *   4. TEETH (memory) — a twin that swaps the two sprite frames MUST be caught at
 *      SPRITE_CODE.
 *   5. TEETH (register) — a twin that drops the phase live-out (leaves E as it found it)
 *      MUST be caught by the register diff. Proves the register half of the gate bites.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-1659.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1659 as oracle } from "../../translated/loc_1659.js";
import { loc_1659 as idiomatic } from "../loc_1659.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { OBJ_X, SPRITE_CODE } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x1659;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

const REFERENCE = 0x806c; // moving reference point
const MOTION_FLAG = 0x8075; // 0 at rest, high-bit marker while moving

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Real attract machine states: run the game and clone it at a spread of frames. Each
 * clone is a genuine in-play machine (real RAM), independent of the source run, with its
 * frame machinery neutralised (safe to run the oracle's steps/ret + tail-call on).
 */
function captureStates(count, stride, startFrame) {
  const m = makeMachine();
  m.runFrames(startFrame);
  const caps = [];
  for (let i = 0; i < count; i++) {
    m.runFrames(stride);
    caps.push(m.clone());
  }
  return caps;
}

/**
 * Run oracle and candidate on independent clones of `entry`; return the first differing
 * state byte and the first differing register (either null when identical). Both arms tail
 * through loc_1b5b, so the register comparison is apples-to-apples.
 */
function runDiff(entry, fn) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  oracle(a);
  fn(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  const regs = firstRegDiff(a.regs, b.regs);
  return { ram, regs };
}

/** Poke the two inputs identically, returning a fresh entry clone. */
function withInputs(base, x, ref) {
  const e = base.clone();
  e.mem.write8(OBJ_X, x);
  e.mem.write8(REFERENCE, ref);
  return e;
}

// -- 1. EQUAL over real captured attract states -------------------------------

test("EQUAL: loc_1659 leaves the same state + registers as the oracle over real attract states", () => {
  const caps = captureStates(10, 90, 120);
  assert.ok(caps.length >= 1, "expected at least one captured attract state");
  for (const cap of caps) {
    const { ram, regs } = runDiff(cap, idiomatic);
    assert.equal(ram, null, ram && `RAM diff at ${hx(ram.addr ?? 0)}: oracle=${ram.a} idiomatic=${ram.b}`);
    assert.equal(regs, null, regs && `register diff at ${regs.reg}: oracle=${regs.a} idiomatic=${regs.b}`);
  }
  console.log(`  EQUAL: ${caps.length} real attract states — state + registers identical to the oracle`);
});

// -- 2. EQUAL over the full offset sweep (all 256 offsets) --------------------

test("EQUAL (sweep): every walk phase, both branches and the wrap edge match the oracle", () => {
  const [base] = captureStates(1, 1, 200);

  let n = 0;
  for (const ref of [0, 7, 100, 255]) {
    for (let x = 0; x < 256; x++) {
      // offset = (x - ref) mod 256 ranges over all 256 values -> every phase 0..7,
      // the rest-point (marker 0) vs moving (marker 0xff) branch, both sprite frames,
      // and the underflow wrap when x < ref.
      const { ram, regs } = runDiff(withInputs(base, x, ref), idiomatic);
      assert.equal(ram, null, ram && `x=${x} ref=${ref}: RAM diff at ${hx(ram.addr ?? 0)} oracle=${ram.a} idiomatic=${ram.b}`);
      assert.equal(regs, null, regs && `x=${x} ref=${ref}: register diff at ${regs.reg} oracle=${regs.a} idiomatic=${regs.b}`);
      n++;
    }
  }
  console.log(`  EQUAL/sweep: ${n} (column,reference) combinations — state + registers identical (all 256 offsets)`);
});

// -- 3. NON-VACUOUS: outputs + phase register are actually written ------------

test("NON-VACUOUS: with outputs + E pre-set to sentinels, every one is overwritten and arms agree", () => {
  const [seed] = captureStates(1, 1, 220);
  // offset = 41 - 3 = 38 -> phase 1: marker 0xff, sprite 0xb2, E 1 — all distinct from the sentinels.
  const entry = withInputs(seed, 41, 3);
  const OUT_SENTINEL = 0x55;
  const E_SENTINEL = 0x99;
  entry.mem.write8(MOTION_FLAG, OUT_SENTINEL); // 0x8075 — distinct from the inputs at 0x8068/0x806c
  entry.mem.write8(SPRITE_CODE, OUT_SENTINEL); // 0x8069 — likewise distinct
  entry.regs.e = E_SENTINEL;

  const a = entry.clone(); // oracle
  const b = entry.clone(); // idiomatic
  oracle(a);
  idiomatic(b);

  assert.notEqual(b.mem.read8(MOTION_FLAG), OUT_SENTINEL, "idiomatic left the motion marker unwritten");
  assert.notEqual(b.mem.read8(SPRITE_CODE), OUT_SENTINEL, "idiomatic left the sprite code unwritten");
  assert.notEqual(b.regs.e, E_SENTINEL, "idiomatic left the phase register (E) unwritten");

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  const regs = firstRegDiff(a.regs, b.regs);
  assert.equal(ram, null, ram && `RAM diff at ${hx(ram.addr ?? 0)}: oracle=${ram.a} idiomatic=${ram.b}`);
  assert.equal(regs, null, regs && `register diff at ${regs.reg}: oracle=${regs.a} idiomatic=${regs.b}`);
  console.log("  NON-VACUOUS: marker, sprite code and phase register all overwritten from their sentinels; arms agree");
});

// -- 4. TEETH (memory): a sprite-frame swap MUST be caught --------------------

/** Broken twin: swaps the two walk frames (odd where it should be even, and vice-versa). */
function twinSpriteSwap(m) {
  const { regs, mem } = m;
  const offset = (mem.read8(OBJ_X) - mem.read8(REFERENCE)) & 0xff;
  mem.write8(OBJ_X, offset);
  const phase = (offset + 3) % 8;
  mem.write8(MOTION_FLAG, phase === 0 ? 0 : 0xff);
  mem.write8(SPRITE_CODE, phase & 2 ? 0xb2 : 0xb3); // BUG: frames swapped
  regs.e = phase;
  return m.call(0x1b5b);
}

test("TEETH (memory): a swapped-sprite twin is CAUGHT at SPRITE_CODE", () => {
  const [seed] = captureStates(1, 1, 240);
  const entry = withInputs(seed, 41, 3); // phase 1 -> the two frames differ

  const { ram } = runDiff(entry, twinSpriteSwap);
  assert.notEqual(ram, null, "the gate FAILED to catch a swapped-sprite twin — it proves nothing");
  assert.equal(ram.addr, SPRITE_CODE, `teeth caught the wrong address ${hx(ram.addr ?? 0)} (expected ${hx(SPRITE_CODE)})`);

  const clean = runDiff(entry, idiomatic);
  assert.equal(clean.ram, null, "idiomatic must pass the entry the twin fails (state)");
  assert.equal(clean.regs, null, "idiomatic must pass the entry the twin fails (registers)");
  console.log(`  TEETH/memory: swapped-sprite twin caught at ${hx(ram.addr)} (oracle=${ram.a} broken=${ram.b})`);
});

// -- 5. TEETH (register): dropping the phase live-out MUST be caught ----------

/** Broken twin: does the right memory work but forgets to leave the phase in E. */
function twinDropPhaseReg(m) {
  const before = m.regs.e;
  idiomatic(m);
  m.regs.e = before; // BUG: drop the phase register the record builder's caller reads
}

test("TEETH (register): a twin that drops the phase live-out (E) is CAUGHT", () => {
  const [seed] = captureStates(1, 1, 260);
  const entry = withInputs(seed, 41, 3); // phase 1
  entry.regs.e = 0x99; // != any phase, so restoring it always diverges

  const { ram, regs } = runDiff(entry, twinDropPhaseReg);
  assert.equal(ram, null, "the register bug must NOT show up as a state diff");
  assert.notEqual(regs, null, "the gate FAILED to catch a dropped phase register — the register half is toothless");
  assert.equal(regs.reg, "e", `teeth caught the wrong register ${regs && regs.reg} (expected e)`);

  const clean = runDiff(entry, idiomatic);
  assert.equal(clean.regs, null, "idiomatic must reproduce the phase register on the same entry");
  console.log(`  TEETH/register: dropped phase register caught at E (oracle=${regs.a} broken=${regs.b})`);
});
