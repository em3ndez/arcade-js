// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for seedObjectRecords (ROM 0x30de, The Pit) — seed the second block
 * of round/level parameters, derive one difficulty-scaled byte pair from the level
 * counter, then tail-jump into seedActorSpawnState (ROM 0x36fe).
 *
 * seedObjectRecords is entered ONLY by the gameplay round-init tail-jump chain
 * (loc_2f2f → seedObjectRecords → loc_36fe); attract mode never enters gameplay, so it is
 * never dispatched in a boot/attract run — the unit harness (which needs a real
 * dispatch) cannot capture it. But the only thing it READS is the level/difficulty
 * counter at 0x8028; everything else is fixed immediates. So its output is a function
 * of that one byte in the entry state, and any realistic machine state is a valid
 * entry. This is the CRAFTED-ENTRY path: capture real attract states and run oracle
 * vs idiomatic on independent clones of each.
 *
 * The oracle tail-jumps `m.call(0x36fe)`, which resolves to the frozen translated
 * loc_36fe; the idiomatic routine hands off to the already-decompiled
 * seedActorSpawnState directly. Those two are proven memory-equivalent by
 * equivalence-36fe.test.js, so the whole chain lands the same work RAM. The Z80-stack
 * plumbing the oracle's ret leaves behind (a bumped stack pointer, a popped return
 * PC) is dead ABI the round-init caller never reads, so the gate compares WORK RAM —
 * the routine's declared live-out — not the register file.
 *
 * FOUR checks:
 *   1. EQUAL (real captured entries) — clone the running attract machine at several
 *      frames (real title/demo RAM), run the oracle and seedObjectRecords on independent clones
 *      of each, and diff work RAM. Must be identical.
 *   2. TAIL FIRED — after the idiomatic run the tail's effects are present (the actor
 *      pair seeded, the spawn-phase flag cleared), proving the hand-off actually ran.
 *   3. NON-VACUOUS + WRITE-COMPLETE (sentinel entry) — pre-set seedObjectRecords's own targets
 *      to a sentinel identically on both sides, so a no-op or partial twin cannot pass
 *      by the entry already holding the seeded values: every target must be
 *      overwritten, and both arms must still agree byte-for-byte.
 *   4. TEETH — two deliberately-broken twins MUST be caught: one that gets the derived
 *      difficulty pair wrong, and one that drops the seedActorSpawnState hand-off.
 *
 * The oracle is run on a clone() (frame machinery neutralised) so its internal cycle
 * steps cannot trip a live NMI whose handler would write RAM and masquerade as a side
 * effect.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-30de.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_30de as oracle } from "../../translated/loc_30de.js";
import { seedObjectRecords as idiomatic } from "../seedObjectRecords.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import {
  BOARD_END_PHASE,
  ENEMY3_X,
  ENEMY3_TILE,
  ENEMY3_Y,
  ENEMY3_TIMER,
  ENEMY3_TWIN_X,
  ENEMY3_TWIN_TILE,
  ENEMY3_TWIN_Y,
} from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const TARGET = 0x30de;
const LEVEL_COUNTER = 0x8028; // the routine's one genuine input (still unnamed in ram.js)
const DERIVED_LO = 0x80f6; // first mirrored slot for the difficulty-scaled pair
const DERIVED_HI = 0x8107; // second mirrored slot (same value)
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// seedObjectRecords's OWN parameter-block writes (the tail's writes are the seedActorSpawnState
// set, listed separately below). Two of these — DERIVED_LO/DERIVED_HI — are computed
// from the level counter; the rest are fixed immediates.
const OWN_ADDRS = [
  0x80e9, 0x80e8, 0x80eb, 0x80ea, 0x80f5, 0x80f0, 0x80f8,
  DERIVED_LO, DERIVED_HI, 0x80fa, 0x80fb, 0x80f9, 0x8106, 0x8101, 0x8109,
];

// The tail seedActorSpawnState's fifteen writes — used to make the dropped-hand-off
// teeth deterministic (BOARD_END_PHASE 0x807b is the lowest of these addresses).
const TAIL_ADDRS = [
  ENEMY3_X, ENEMY3_TILE, ENEMY3_Y, 0x810c, 0x810e, 0x810f, ENEMY3_TIMER,
  ENEMY3_TWIN_X, ENEMY3_TWIN_TILE, ENEMY3_TWIN_Y, 0x811d, 0x811f, 0x8120, 0x8123,
  BOARD_END_PHASE,
];

// The engine drives makeMachine(overrides) synchronously; The Pit's registry is
// async, so build the factory once.
const makeMachine = ROM_PRESENT ? await makeMachineFactory(ROM) : null;

/**
 * Real attract machine states: run the game and clone it at a spread of frames. Each
 * clone is a genuine in-play machine (real title/demo RAM), independent of the source
 * run, with its frame machinery neutralised (safe to run the oracle on).
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

// -- 1. EQUAL over real captured attract states -------------------------------

test("EQUAL: seedObjectRecords leaves the same work RAM as the oracle over real captured states", () => {
  const caps = captureStates(8, 120, 90);
  assert.ok(caps.length >= 1, "expected at least one captured attract state");
  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // idiomatic
    oracle(a);
    idiomatic(b);
    const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      d,
      null,
      d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`,
    );
  }
  console.log(`  EQUAL: ${caps.length} real captured attract states — work RAM identical to the oracle`);
});

// -- 2. TAIL FIRED: the seedActorSpawnState hand-off actually ran -------------
// The derived pair also tracks the entry's level counter, so verify it directly.

test("TAIL FIRED: the derived pair matches 7 - (counter & 6) and the actor seed is present", () => {
  const [entry] = captureStates(1, 1, 175);
  const level = entry.mem.read8(LEVEL_COUNTER);
  const expectedStep = 7 - (level & 0x06);

  const b = entry.clone();
  idiomatic(b);

  assert.equal(b.mem.read8(DERIVED_LO), expectedStep, "first mirrored slot must be the difficulty step");
  assert.equal(b.mem.read8(DERIVED_HI), expectedStep, "second mirrored slot must equal the first");
  // Tail effects: the actor pair seeded to its start pose and the spawn-phase cleared.
  assert.equal(b.mem.read8(ENEMY3_X), 36, "the tail must seed the primary start column");
  assert.equal(b.mem.read8(ENEMY3_TWIN_X), 52, "the tail must seed the twin start column");
  assert.equal(b.mem.read8(BOARD_END_PHASE), 0, "the tail must clear the spawn-phase flag");
  console.log(`  TAIL FIRED: counter=${level} -> step=${expectedStep}; actor pair seeded, spawn-phase cleared`);
});

// -- 2b. COUNTER SWEEP: the derived pair genuinely tracks the level counter ----
// Attract runs with the counter at 0, so real captures only ever exercise step 7.
// Poke the counter across its full byte range (identically on both sides) to prove
// the routine READS and DERIVES from it — a twin that hard-coded 7 would pass the
// EQUAL check above but fail here — and that oracle and idiomatic agree over the
// whole input domain.

test("COUNTER SWEEP: idiomatic == oracle across all 256 level-counter values, and the pair tracks it", () => {
  const [base] = captureStates(1, 1, 200);
  for (let level = 0; level < 256; level++) {
    const a = base.clone(); // oracle
    const b = base.clone(); // idiomatic
    a.mem.write8(LEVEL_COUNTER, level);
    b.mem.write8(LEVEL_COUNTER, level);
    oracle(a);
    idiomatic(b);
    const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(d, null, d && `level=${level}: RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
    const expectedStep = 7 - (level & 0x06);
    assert.equal(b.mem.read8(DERIVED_LO), expectedStep, `level=${level}: derived step must be 7 - (level & 6)`);
    assert.equal(b.mem.read8(DERIVED_HI), expectedStep, `level=${level}: both mirrored slots must match`);
  }
  console.log("  COUNTER SWEEP: all 256 counter values — work RAM identical, derived pair tracks 7 - (level & 6)");
});

// -- 3. NON-VACUOUS + WRITE-COMPLETE (sentinel entry) -------------------------

test("NON-VACUOUS: with seedObjectRecords's own targets pre-set to a sentinel, both arms overwrite them and agree", () => {
  const [entry] = captureStates(1, 1, 200);
  const SENTINEL = 0x55; // 85 — never a value the routine writes (fixed or derived)
  for (const addr of OWN_ADDRS) entry.mem.write8(addr, SENTINEL);

  const a = entry.clone(); // oracle
  const b = entry.clone(); // idiomatic
  oracle(a);
  idiomatic(b);

  for (const addr of OWN_ADDRS) {
    assert.notEqual(
      b.mem.read8(addr),
      SENTINEL,
      `idiomatic left ${hx(addr)} unwritten (still the sentinel)`,
    );
  }
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
  console.log(`  NON-VACUOUS: all ${OWN_ADDRS.length} own targets overwritten from the sentinel, arms agree`);
});

// -- 4. TEETH: broken twins the gate MUST catch -------------------------------

/** Broken twin A: seeds everything, but the derived difficulty pair is one off. */
function brokenDerivedPair(m) {
  idiomatic(m);
  m.mem.write8(DERIVED_LO, m.mem.read8(DERIVED_LO) + 1); // BUG: wrong difficulty step
}

/** Broken twin B: does seedObjectRecords's own writes but drops the seedActorSpawnState tail. */
function brokenNoTail(m) {
  const { mem } = m;
  mem.write8(0x80e9, 9);
  mem.write8(0x80e8, 236);
  mem.write8(0x80eb, 35);
  mem.write8(0x80ea, 4);
  mem.write8(0x80f5, 1);
  mem.write8(0x80f0, 1);
  mem.write8(0x80f8, 4);
  const difficultyStep = 7 - (mem.read8(LEVEL_COUNTER) & 0x06);
  mem.write8(DERIVED_LO, difficultyStep);
  mem.write8(DERIVED_HI, difficultyStep);
  mem.write8(0x80fa, 9);
  mem.write8(0x80fb, 4);
  mem.write8(0x80f9, 0);
  mem.write8(0x8106, 0);
  mem.write8(0x8101, 1);
  mem.write8(0x8109, 5);
  // BUG: no hand-off to seedActorSpawnState — the actor pair is never seeded.
}

test("TEETH: a wrong derived difficulty pair is CAUGHT", () => {
  const caps = captureStates(4, 120, 150);
  let caught = null;
  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // broken twin
    oracle(a);
    brokenDerivedPair(b);
    const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    if (d) {
      caught = d;
      break;
    }
  }
  assert.notEqual(caught, null, "the gate FAILED to catch a wrong derived pair — it proves nothing");
  assert.equal(caught.addr, DERIVED_LO, `teeth caught the wrong address ${hx(caught.addr ?? 0)}`);
  console.log(`  TEETH: wrong derived pair caught at ${hx(caught.addr)} (oracle=${caught.a} broken=${caught.b})`);
});

test("TEETH: dropping the seedActorSpawnState hand-off is CAUGHT", () => {
  const [entry] = captureStates(1, 1, 220);
  const SENTINEL = 0x55; // preset the tail's targets so a missing hand-off is deterministic
  for (const addr of TAIL_ADDRS) entry.mem.write8(addr, SENTINEL);

  const a = entry.clone(); // oracle (runs the tail)
  const b = entry.clone(); // broken twin (no tail)
  oracle(a);
  brokenNoTail(b);

  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.notEqual(d, null, "the gate FAILED to catch a dropped hand-off — it proves nothing");
  assert.equal(d.addr, BOARD_END_PHASE, `teeth caught ${hx(d.addr ?? 0)} (expected the tail's ${hx(BOARD_END_PHASE)})`);
  assert.equal(b.mem.read8(BOARD_END_PHASE), SENTINEL, "the broken twin never cleared the spawn-phase flag");
  console.log(`  TEETH: dropped hand-off caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
