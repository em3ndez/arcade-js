// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for advanceActorWalk (ROM 0x19d0) — the "keep moving" arm of the
 * actor-movement dispatch: it carries the OBJ_Y position accumulator forward by the actor's
 * per-frame step (0x806d), picks the walk frame off bit 1 of the new position (base frame
 * 0x34, or the same frame mirrored 0xb4), then hands that frame to the already-decompiled
 * tail drawActorWalkFrame (0x19e3), which commits it and builds the object's record.
 *
 * OBSERVABLE-EQUIVALENCE CONTRACT. The idiomatic routine calls the decompiled
 * drawActorWalkFrame -> stageObjectSpriteRecord chain directly instead of routing through the Z80
 * registry, and leaves NO genuine register live-out (the record builder's return unwinds to
 * the caller). So the gate is memory-only: the full RAM dump (work + colour + video + attr)
 * via firstStateDiff, NOT the register file. The oracle reaches the shared record tail 0x1b5b
 * as a tail-jump whose ret only reads the caller's return address and whose body clobbers dead
 * value registers and moves SP; the direct call touches none of them, and stageObjectSpriteRecord makes no
 * nested call, so there is no stack-scratch window to exclude (same as the walkActor and
 * drawActorWalkFrame dissolves — verified byte-for-byte on every arm).
 *
 * loc_19d0 IS naturally dispatched in attract (the movement continuation reached from the dig
 * classifier), so real captured states drive the main check; a crafted accumulator sweep then
 * covers every new position (both walk frames + the add's byte wrap). Attract keeps the
 * goal-crossing latch clear, so the delegated far-edge one-shot never fires here — its own
 * one-shot is proven in equivalence-19e3; this gate proves the advance + frame selection.
 *
 * FIVE checks:
 *   0. IDENTITY (harness) — capture a real loc_19d0 attract state, oracle vs oracle EQUAL.
 *      Proves the capture/clone/replay plumbing reaches a real actor-movement state.
 *   1. EQUAL (real states) — for every captured attract state, oracle vs advanceActorWalk leave
 *      an identical RAM dump (records the whole delegated chain's writes too).
 *   2. EQUAL (accumulator sweep) — poke position/step so the new value ranges over all 256
 *      (both walk frames, the byte wrap), identically on both arms; the whole state must match.
 *   3. NON-VACUOUS + WRITE-COMPLETE — pre-set the position accumulator and the sprite-code cell
 *      to a sentinel so a no-op/partial twin cannot pass by the entry already holding the
 *      answer: both are overwritten and both arms agree.
 *   4. TEETH (frame) — a twin that SWAPS the two walk frames MUST be caught at SPRITE_CODE.
 *   5. TEETH (advance) — a twin that advances the accumulator by the wrong amount MUST be caught
 *      at OBJ_Y.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-19d0.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_19d0 as oracle } from "../../translated/loc_19d0.js";
import { advanceActorWalk as idiomatic } from "../advanceActorWalk.js";
import { drawActorWalkFrame } from "../drawActorWalkFrame.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { OBJ_Y, SPRITE_CODE, GOAL_CROSSING_LATCH } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const CAPTURE_AT = 0x19d0; // advanceActorWalk — dispatched in attract from the movement continuation
const STEP = 0x806d; // per-frame step added onto the OBJ_Y position accumulator
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is async, so
// build the factory once (it closes over the built registry).
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Hook loc_19d0 in a real attract run and clone up to K real dispatches — each a genuine
 * in-play machine state for the walk stepper. The wrapper snapshots then runs the oracle so
 * attract proceeds undisturbed.
 */
function captureStates(K, maxFrames) {
  const caps = [];
  const snapshot = new Map([[CAPTURE_AT, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  makeMachine(snapshot).runFrames(maxFrames);
  return caps;
}

/** Run oracle and candidate on independent clones of `entry`; return the first differing RAM
 *  dump byte (or null). The dump is RAM-only, so pc/SP/dead registers are excluded for free. */
function stateDiff(entry, fn) {
  const a = entry.clone(); // oracle
  const b = entry.clone(); // candidate
  oracle(a);
  fn(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/** A fresh entry clone with the two inputs poked, and the goal-crossing latch forced clear so
 *  the delegated far-edge one-shot stays out of the way (attract keeps it clear anyway). */
function withInputs(base, y, step) {
  const e = base.clone();
  e.mem.write8(OBJ_Y, y);
  e.mem.write8(STEP, step);
  e.mem.write8(GOAL_CROSSING_LATCH, 0);
  return e;
}

// -- 0. IDENTITY (harness sanity) --------------------------------------------

test("IDENTITY: the harness reaches a real loc_19d0 state and oracle-vs-oracle is EQUAL", () => {
  const [base] = captureStates(1, 3000);
  assert.ok(base, "expected at least one real loc_19d0 dispatch during attract");
  assert.equal(stateDiff(base, oracle), null, "oracle vs oracle must be identical");
  console.log("  IDENTITY: captured a real loc_19d0 state, cloned, ran oracle vs oracle -> EQUAL");
});

// -- 1. EQUAL over real captured attract states ------------------------------

test("EQUAL: advanceActorWalk leaves the same RAM as the oracle over every real captured state", () => {
  const caps = captureStates(300, 3000);
  assert.ok(caps.length >= 1, "expected at least one captured attract state");
  for (const cap of caps) {
    const d = stateDiff(cap, idiomatic);
    assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
  }
  console.log(`  EQUAL/real: ${caps.length} real captured attract states — state identical to the oracle`);
});

// -- 2. EQUAL over the full accumulator sweep (all 256 new values) -----------

test("EQUAL (sweep): every new position, both walk frames and the add's byte wrap match the oracle", () => {
  const [base] = captureStates(1, 3000);
  assert.ok(base, "need a real capture to sweep from");

  let n = 0;
  for (const step of [0, 1, 2, 3, 200, 255]) {
    for (let y = 0; y < 256; y++) {
      // (y + step) mod 256 ranges over all 256 new positions -> both walk frames (bit 1 of
      // the result set/clear) and the add's byte wrap when y + step > 255.
      const d = stateDiff(withInputs(base, y, step), idiomatic);
      assert.equal(d, null, d && `y=${y} step=${step}: RAM diff at ${hx(d.addr ?? 0)} oracle=${d.a} idiomatic=${d.b}`);
      n++;
    }
  }
  console.log(`  EQUAL/sweep: ${n} (position,step) combinations — state identical (all 256 new values)`);
});

// -- 3. NON-VACUOUS + WRITE-COMPLETE: outputs are actually written -----------

test("NON-VACUOUS: with the accumulator and sprite-code pre-set to a sentinel, both are overwritten and arms agree", () => {
  const [seed] = captureStates(1, 3000);
  assert.ok(seed, "need a real capture");
  // y+step = 40+3 = 43 -> bit 1 of 43 (0b101011) is set -> mirrored frame 0xb4, and 43 differs
  // from the sentinel so "overwritten" is observable.
  const entry = withInputs(seed, 40, 3);
  const SENTINEL = 0x55;
  entry.mem.write8(SPRITE_CODE, SENTINEL);

  const a = entry.clone(); // oracle
  const b = entry.clone(); // idiomatic
  oracle(a);
  idiomatic(b);

  assert.equal(b.mem.read8(OBJ_Y), 43, "idiomatic did not advance the position accumulator (40 -> 43)");
  assert.notEqual(b.mem.read8(SPRITE_CODE), SENTINEL, "idiomatic left the sprite code unwritten");
  assert.equal(b.mem.read8(SPRITE_CODE), 0xb4, "idiomatic committed the wrong walk frame for a bit-1-set position");

  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
  console.log("  NON-VACUOUS: accumulator and sprite code both written; arms agree");
});

// -- 4. TEETH (frame): a swapped-frame twin MUST be caught -------------------

/** Broken twin: does the right advance but SWAPS the two walk frames. */
function twinSwapFrame(m) {
  const { mem8 } = m;
  mem8[OBJ_Y] = mem8[OBJ_Y] + mem8[STEP];
  const walkFrame = mem8[OBJ_Y] & 2 ? 0x34 : 0xb4; // BUG: frames swapped
  return drawActorWalkFrame(m, walkFrame);
}

test("TEETH (frame): a swapped-frame twin is CAUGHT at SPRITE_CODE", () => {
  const [base] = captureStates(1, 3000);
  const entry = withInputs(base, 40, 3); // new position 43 -> bit 1 set, the two frames differ

  const d = stateDiff(entry, twinSwapFrame);
  assert.notEqual(d, null, "the gate FAILED to catch a swapped-frame twin — it proves nothing");
  assert.equal(d.addr, SPRITE_CODE, `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(SPRITE_CODE)})`);

  assert.equal(stateDiff(entry, idiomatic), null, "idiomatic must pass the entry the twin fails");
  console.log(`  TEETH/frame: swapped-frame twin caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

// -- 5. TEETH (advance): a wrong accumulator advance MUST be caught ----------

/** Broken twin: over-advances the accumulator by 4 — a step that keeps bit 1 unchanged, so
 *  the picked walk frame still matches and the ONLY divergence is the position itself. */
function twinWrongAdvance(m) {
  const { mem8 } = m;
  mem8[OBJ_Y] = mem8[OBJ_Y] + mem8[STEP] + 4; // BUG: advanced too far (bit 1 preserved)
  const walkFrame = mem8[OBJ_Y] & 2 ? 0xb4 : 0x34;
  return drawActorWalkFrame(m, walkFrame);
}

test("TEETH (advance): a twin that advances the accumulator by the wrong amount is CAUGHT at OBJ_Y", () => {
  const [base] = captureStates(1, 3000);
  const entry = withInputs(base, 40, 3);

  const d = stateDiff(entry, twinWrongAdvance);
  assert.notEqual(d, null, "the gate FAILED to catch a wrong-advance twin — it proves nothing");
  assert.equal(d.addr, OBJ_Y, `teeth caught the wrong address ${hx(d.addr ?? 0)} (expected ${hx(OBJ_Y)})`);

  assert.equal(stateDiff(entry, idiomatic), null, "idiomatic must pass the entry the twin fails");
  console.log(`  TEETH/advance: wrong-advance twin caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
