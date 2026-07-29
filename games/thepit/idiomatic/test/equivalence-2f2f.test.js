// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for seedZonker (ROM 0x2f2f, The Pit) — seed the first block
 * of round/level parameters, derive the animation reload byte from the level counter,
 * then tail-jump into seedEnemyRecords (ROM 0x30de).
 *
 * seedZonker is entered ONLY by the gameplay round-init tail-jump chain
 * (loc_287a → seedZonker → seedEnemyRecords → seedActorSpawnState); attract mode never enters
 * gameplay, so it is never dispatched in a boot/attract run — the unit harness (which
 * needs a real dispatch) cannot capture it. But the only thing it READS is the
 * level/difficulty counter at 0x8028; everything else is fixed immediates. So its
 * output is a function of that one byte in the entry state, and any realistic machine
 * state is a valid entry. This is the CRAFTED-ENTRY path: capture real attract states
 * and run oracle vs idiomatic on independent clones of each.
 *
 * The oracle tail-jumps `m.call(0x30de)`, which resolves to the frozen translated
 * seedEnemyRecords (which in turn resolves the rest of the chain); the idiomatic routine hands
 * off to the already-decompiled seedEnemyRecords directly. That pair is proven
 * memory-equivalent by equivalence-30de.test.js, so the whole chain lands the same
 * work RAM. The Z80-stack plumbing the oracle's ret leaves behind (a bumped stack
 * pointer, a popped return PC) is dead ABI the round-init caller never reads, so the
 * gate compares WORK RAM — the routine's declared live-out — not the register file.
 *
 * FIVE checks:
 *   1. EQUAL (real captured entries) — clone the running attract machine at several
 *      frames (real title/demo RAM), run the oracle and seedZonker on independent clones
 *      of each, and diff work RAM. Must be identical.
 *   2. TAIL FIRED — after the idiomatic run the derived reload byte tracks the entry's
 *      level counter AND the full tail's effects are present (seedEnemyRecords's derived pair,
 *      the actor pair seeded, the spawn-phase flag cleared), proving the hand-off ran.
 *   3. COUNTER SWEEP — over all 256 level-counter values, idiomatic == oracle and the
 *      reload byte tracks 7 - min((level + 1) mod 256, 4). Attract only ever exercises
 *      one counter value, so this is what proves the routine READS and DERIVES from it.
 *   4. NON-VACUOUS + WRITE-COMPLETE (sentinel entry) — pre-set seedZonker's own targets
 *      to a sentinel identically on both sides, so a no-op or partial twin cannot pass
 *      by the entry already holding the seeded values: every target must be
 *      overwritten, and both arms must still agree byte-for-byte.
 *   5. TEETH — two deliberately-broken twins MUST be caught: one that gets the derived
 *      reload byte wrong, and one that drops the seedEnemyRecords hand-off.
 *
 * The oracle is run on a clone() (frame machinery neutralised) so its internal cycle
 * steps cannot trip a live NMI whose handler would write RAM and masquerade as a side
 * effect.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-2f2f.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2f2f as oracle } from "../../translated/loc_2f2f.js";
import { seedZonker as idiomatic } from "../seedZonker.js";
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

const TARGET = 0x2f2f;
const LEVEL_COUNTER = 0x8028; // the routine's one genuine input (still unnamed in ram.js)
const RELOAD = 0x80e4; // the derived animation reload byte
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// The expected reload byte: increment the counter (wrapping in a byte), hold it at a
// ceiling of four, and take seven minus that.
const expectedReload = (level) => 7 - Math.min((level + 1) & 0xff, 4);

// seedZonker's OWN parameter-block writes. RELOAD is derived from the level counter; the
// rest are fixed immediates. (0x80e1/0x80e2 are deliberately skipped by the routine.)
const OWN_ADDRS = [
  0x80db, 0x80dc, 0x80dd, 0x80de, 0x80df, 0x80e0, 0x80e3, RELOAD, 0x80e5, 0x80e6, 0x80e7,
];

// Every address the whole tail (seedEnemyRecords + seedActorSpawnState) writes — used to make
// the dropped-hand-off teeth deterministic. BOARD_END_PHASE (0x807b) is the lowest of them,
// so it is the address firstStateDiff reports when the hand-off is missing.
const TAIL_ADDRS = [
  BOARD_END_PHASE,
  // seedEnemyRecords's own block
  0x80e8, 0x80e9, 0x80ea, 0x80eb, 0x80f0, 0x80f5, 0x80f6, 0x80f8, 0x80f9, 0x80fa, 0x80fb,
  0x8101, 0x8106, 0x8107, 0x8109,
  // seedActorSpawnState's block
  ENEMY3_X, ENEMY3_TILE, ENEMY3_Y, 0x810c, 0x810e, 0x810f, ENEMY3_TIMER,
  ENEMY3_TWIN_X, ENEMY3_TWIN_TILE, ENEMY3_TWIN_Y, 0x811d, 0x811f, 0x8120, 0x8123,
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

test("EQUAL: seedZonker leaves the same work RAM as the oracle over real captured states", () => {
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

// -- 2. TAIL FIRED: the seedEnemyRecords hand-off (and its own tail) actually ran ------

test("TAIL FIRED: the reload byte tracks the level counter and the full tail's effects are present", () => {
  const [entry] = captureStates(1, 1, 175);
  const level = entry.mem.read8(LEVEL_COUNTER);

  const b = entry.clone();
  idiomatic(b);

  assert.equal(b.mem.read8(RELOAD), expectedReload(level), "the derived reload byte must track the level counter");
  // seedEnemyRecords's own effect: the difficulty-scaled pair it derives from the same counter.
  const expectedStep = 7 - (level & 0x06);
  assert.equal(b.mem.read8(0x80f6), expectedStep, "seedEnemyRecords's derived pair must be present (first slot)");
  assert.equal(b.mem.read8(0x8107), expectedStep, "seedEnemyRecords's derived pair must be present (mirror slot)");
  // seedActorSpawnState's effect at the end of the chain.
  assert.equal(b.mem.read8(ENEMY3_X), 36, "the chain's tail must seed the primary start column");
  assert.equal(b.mem.read8(ENEMY3_TWIN_X), 52, "the chain's tail must seed the twin start column");
  assert.equal(b.mem.read8(BOARD_END_PHASE), 0, "the chain's tail must clear the spawn-phase flag");
  console.log(`  TAIL FIRED: counter=${level} -> reload=${expectedReload(level)}; full seed chain ran`);
});

// -- 3. COUNTER SWEEP: the reload byte genuinely tracks the level counter ------
// Attract runs with the counter fixed, so real captures only exercise one reload
// value. Poke the counter across its full byte range (identically on both sides) to
// prove the routine READS and DERIVES from it — a twin that hard-coded the reload
// would pass the EQUAL check above but fail here — and that oracle and idiomatic agree
// over the whole input domain (an exhaustive sweep of the one input).

test("COUNTER SWEEP: idiomatic == oracle across all 256 level-counter values, and the reload tracks it", () => {
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
    assert.equal(
      b.mem.read8(RELOAD),
      expectedReload(level),
      `level=${level}: reload must be 7 - min((level + 1) mod 256, 4)`,
    );
  }
  console.log("  COUNTER SWEEP: all 256 counter values — work RAM identical, reload tracks 7 - min((level+1) mod 256, 4)");
});

// -- 4. NON-VACUOUS + WRITE-COMPLETE (sentinel entry) -------------------------

test("NON-VACUOUS: with seedZonker's own targets pre-set to a sentinel, both arms overwrite them and agree", () => {
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

// -- 5. TEETH: broken twins the gate MUST catch -------------------------------

/** Broken twin A: seeds everything, but the derived reload byte is one off. */
function brokenReload(m) {
  idiomatic(m);
  m.mem.write8(RELOAD, m.mem.read8(RELOAD) + 1); // BUG: wrong animation reload byte
}

/** Broken twin B: does seedZonker's own writes but drops the seedEnemyRecords hand-off. */
function brokenNoTail(m) {
  const { mem } = m;
  mem.write8(0x80db, 40);
  mem.write8(0x80dc, 57);
  mem.write8(0x80dd, 192);
  mem.write8(0x80de, 120);
  mem.write8(0x80df, 1);
  mem.write8(0x80e0, 252);
  mem.write8(0x80e3, 1);
  mem.write8(0x80e5, 1);
  mem.write8(0x80e6, 150);
  mem.write8(0x80e7, 0);
  mem.write8(RELOAD, 7 - Math.min((mem.read8(LEVEL_COUNTER) + 1) & 0xff, 4));
  // BUG: no hand-off to seedEnemyRecords — the second parameter block and actor pair are never seeded.
}

test("TEETH: a wrong derived reload byte is CAUGHT", () => {
  const caps = captureStates(4, 120, 150);
  let caught = null;
  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // broken twin
    oracle(a);
    brokenReload(b);
    const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    if (d) {
      caught = d;
      break;
    }
  }
  assert.notEqual(caught, null, "the gate FAILED to catch a wrong reload byte — it proves nothing");
  assert.equal(caught.addr, RELOAD, `teeth caught the wrong address ${hx(caught.addr ?? 0)}`);
  console.log(`  TEETH: wrong reload byte caught at ${hx(caught.addr)} (oracle=${caught.a} broken=${caught.b})`);
});

test("TEETH: dropping the seedEnemyRecords hand-off is CAUGHT", () => {
  const [entry] = captureStates(1, 1, 220);
  const SENTINEL = 0x55; // preset the tail's targets so a missing hand-off is deterministic
  for (const addr of TAIL_ADDRS) entry.mem.write8(addr, SENTINEL);

  const a = entry.clone(); // oracle (runs the tail)
  const b = entry.clone(); // broken twin (no tail)
  oracle(a);
  brokenNoTail(b);

  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.notEqual(d, null, "the gate FAILED to catch a dropped hand-off — it proves nothing");
  assert.equal(d.addr, BOARD_END_PHASE, `teeth caught ${hx(d.addr ?? 0)} (expected the tail's lowest write ${hx(BOARD_END_PHASE)})`);
  assert.equal(b.mem.read8(BOARD_END_PHASE), SENTINEL, "the broken twin never cleared the spawn-phase flag");
  console.log(`  TEETH: dropped hand-off caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
