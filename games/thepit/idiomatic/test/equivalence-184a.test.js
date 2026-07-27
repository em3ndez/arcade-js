// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence gate for walkActor (ROM 0x184a) — the walk stepper that carries an actor's
 * position forward by its per-frame step (0x806c), reads a sub-tile walk phase off the new
 * position (stored at 0x8075), picks the alternating walk sprite (SPRITE_CODE), then calls
 * the record builder stageObjectSpriteRecord to write the actor's 4-byte display record.
 *
 * OBSERVABLE-EQUIVALENCE CONTRACT. The idiomatic routine calls the already-decompiled
 * stageObjectSpriteRecord directly instead of routing through the Z80 registry, and unlike the sibling
 * advanceObjectWalkFrame it leaves NO genuine register live-out — the step value it happens to leave in
 * a register is dead scratch nothing downstream reads. So the gate is memory-only: the full
 * RAM dump (work + colour + video + attr) via firstStateDiff, NOT the register file. The
 * oracle reaches loc_1b5b as a tail-jump whose ret only READS the caller's return address
 * (it writes nothing to the stack) and whose body clobbers dead value registers and moves
 * SP, while the direct call touches none of them — all excluded, and RAM is compared in
 * full with no stack window to skip (same as the advanceObjectWalkFrame dissolve).
 *
 * CRAFTED ENTRY. Attract never dispatches 0x184a (measured: 0 in 1500 frames). The routine
 * reads only work RAM, so any real attract clone with its two inputs poked is a valid entry,
 * and the walk logic depends only on (position + step) mod 256 — swept over all 256 new
 * positions for several step values, covering every phase 0..7, both sprite frames, and the
 * accumulator's byte wrap.
 *
 * FOUR checks:
 *   1. EQUAL (real captured attract states) — clone the running attract machine at a spread
 *      of frames (genuine in-play RAM), run oracle vs idiomatic on independent clones, and
 *      diff the whole state dump. Must be identical (records the record builder's writes too).
 *   2. EQUAL (position sweep) — poke position/step so the accumulated result ranges over all
 *      256 values (every phase, both sprite frames, and the add's byte wrap), identically on
 *      both arms; the whole state must match. This is the airtight correctness evidence.
 *   3. NON-VACUOUS + WRITE-COMPLETE (sentinel entry) — pre-set the three output bytes to a
 *      sentinel so a no-op or partial twin cannot pass by the entry already holding the
 *      answer: every output must be overwritten and both arms agree.
 *   4. TEETH — a twin that SWAPS the two walk frames MUST be caught at SPRITE_CODE; forced
 *      onto a phase where the two frames differ so the twin genuinely diverges.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-184a.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_184a as oracle } from "../../translated/loc_184a.js";
import { walkActor as idiomatic } from "../walkActor.js";
import { stageObjectSpriteRecord } from "../stageObjectSpriteRecord.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { OBJ_X, SPRITE_CODE } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const hx = (v) => "0x" + (v & 0xffff).toString(16);

const STEP = 0x806c; // per-frame step added onto the position accumulator
const SUBTILE_PHASE = 0x8075; // low-3-bit walk phase written by the stepper

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Real attract machine states: run the game and clone it at a spread of frames. Each clone
 * is a genuine in-play machine (real RAM), independent of the source run, with its frame
 * machinery neutralised (safe to run the oracle's steps/ret + tail-call on).
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

/** Run oracle and candidate on independent clones of `entry`; return the first differing
 *  state byte (or null). RAM is diffed in full — the oracle's tail-jump writes nothing to
 *  the stack, so there is no stack-scratch window to exclude. */
function stateDiff(entry, fn) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  oracle(a);
  fn(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** Poke the two inputs identically, returning a fresh entry clone. */
function withInputs(base, x, step) {
  const e = base.clone();
  e.mem.write8(OBJ_X, x);
  e.mem.write8(STEP, step);
  return e;
}

// -- 1. EQUAL over real captured attract states -------------------------------

test("EQUAL: walkActor leaves the same state as the oracle over real captured attract states", () => {
  const caps = captureStates(10, 90, 120);
  assert.ok(caps.length >= 1, "expected at least one captured attract state");
  for (const cap of caps) {
    const d = stateDiff(cap, idiomatic);
    assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
  }
  console.log(`  EQUAL: ${caps.length} real captured attract states — state identical to the oracle`);
});

// -- 2. EQUAL over the full position sweep (all 256 accumulated values) -------

test("EQUAL (sweep): every walk phase, both sprite frames and the add's byte wrap match the oracle", () => {
  const [base] = captureStates(1, 1, 200);

  let n = 0;
  for (const step of [0, 1, 3, 200, 255]) {
    for (let x = 0; x < 256; x++) {
      // (x + step) mod 256 ranges over all 256 new positions -> every phase 0..7, both
      // sprite frames, and the byte wrap when x + step > 255.
      const d = stateDiff(withInputs(base, x, step), idiomatic);
      assert.equal(d, null, d && `x=${x} step=${step}: RAM diff at ${hx(d.addr ?? 0)} oracle=${d.a} idiomatic=${d.b}`);
      n++;
    }
  }
  console.log(`  EQUAL/sweep: ${n} (position,step) combinations — state identical (all 256 accumulated values)`);
});

// -- 3. NON-VACUOUS + WRITE-COMPLETE: outputs are actually written ------------

test("NON-VACUOUS: with the three outputs pre-set to a sentinel, every one is overwritten and arms agree", () => {
  const [seed] = captureStates(1, 1, 220);
  // x+step = 40+3 = 43 -> phase (43+3)&7 = 6: sprite 0x33, phase byte 6, accumulator 43 —
  // all distinct from the sentinel so "overwritten" is observable.
  const entry = withInputs(seed, 40, 3); // OBJ_X carries the input position (40)
  const SENTINEL = 0x55;
  entry.mem.write8(SUBTILE_PHASE, SENTINEL);
  entry.mem.write8(SPRITE_CODE, SENTINEL);

  const a = entry.clone(); // oracle
  const b = entry.clone(); // idiomatic
  oracle(a);
  idiomatic(b);

  assert.notEqual(b.mem.read8(SUBTILE_PHASE), SENTINEL, "idiomatic left the phase byte unwritten");
  assert.notEqual(b.mem.read8(SPRITE_CODE), SENTINEL, "idiomatic left the sprite code unwritten");
  // the accumulator must have advanced from its input (40 -> 43)
  assert.equal(b.mem.read8(OBJ_X), 43, "idiomatic did not advance the position accumulator");

  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
  console.log("  NON-VACUOUS: phase byte, sprite code and accumulator all written; arms agree");
});

// -- 4. TEETH: a swapped-sprite twin MUST be caught --------------------------

/** Broken twin: does the right position/phase work but SWAPS the two walk frames. */
function twinSpriteSwap(m) {
  const { mem8 } = m;
  mem8[OBJ_X] = mem8[OBJ_X] + mem8[STEP];
  const phase = (mem8[OBJ_X] + 3) % 8;
  mem8[SUBTILE_PHASE] = phase;
  mem8[SPRITE_CODE] = phase & 2 ? 0x32 : 0x33; // BUG: frames swapped
  return stageObjectSpriteRecord(m);
}

test("TEETH: a swapped-sprite twin is CAUGHT at SPRITE_CODE", () => {
  const [seed] = captureStates(1, 1, 240);
  const entry = withInputs(seed, 40, 3); // phase 6 -> phase bit 1 set, the two frames differ

  const d = stateDiff(entry, twinSpriteSwap);
  assert.notEqual(d, null, "the gate FAILED to catch a swapped-sprite twin — it proves nothing");
  assert.equal(d.addr, SPRITE_CODE, `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(SPRITE_CODE)})`);

  // and the correct routine is still EQUAL on the very same entry
  assert.equal(stateDiff(entry, idiomatic), null, "idiomatic must pass the entry the twin fails");
  console.log(`  TEETH: swapped-sprite twin caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
