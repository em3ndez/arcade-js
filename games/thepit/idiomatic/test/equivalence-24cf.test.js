// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence gate for resetReactionState (ROM 0x24cf, The Pit) — reset the per-object
 * reaction state machine to idle, seed its companion control bytes, then tail-jump
 * into the dig-object / round-parameter seeding chain (loc_287a → loc_2f2f →
 * seedEnemyRecords → seedActorSpawnState).
 *
 * resetReactionState is entered ONLY at gameplay round init, above loc_287a in that tail-jump
 * chain; attract mode never enters gameplay, so it is never dispatched in a
 * boot/attract run — the unit harness (which needs a real dispatch) cannot capture
 * it. But its own body reads NOTHING from the entry state: it writes fixed
 * immediates and then hands off. The only variable input in the whole chain is the
 * level/difficulty counter the tail reads, so any realistic machine state is a valid
 * entry. This is the CRAFTED-ENTRY path: capture real attract states and run oracle
 * vs idiomatic on independent clones of each.
 *
 * The oracle tail-jumps `m.call(0x287a)`, which resolves to the frozen translated
 * loc_287a (which in turn resolves the rest of the chain); the idiomatic routine
 * hands off to the already-decompiled loc_287a directly. That pair — and the rest of
 * the chain — is proven memory-equivalent by equivalence-287a / equivalence-2f2f /
 * equivalence-30de, so the whole chain lands the same work RAM. The entire chain is
 * pure tail-jumps with a single trailing return (no stack pushes), so the Z80 stack
 * is untouched and the gate compares FULL work RAM, the routine's declared live-out,
 * not the register file.
 *
 * FIVE checks:
 *   1. EQUAL (real captured entries) — clone the running attract machine at several
 *      frames (real title/demo RAM), run the oracle and resetReactionState on independent
 *      clones of each, and diff full work RAM. Must be identical.
 *   2. TAIL FIRED — after the idiomatic run the reaction block holds its seeded
 *      values AND the full tail's effects are present (the dig-object state code, the
 *      actor pair seeded, the spawn-phase flag cleared), proving the hand-off ran
 *      through the imported chain.
 *   3. NON-VACUOUS + WRITE-COMPLETE (sentinel entry) — pre-set resetReactionState's own targets
 *      to a sentinel identically on both sides, so a no-op or partial twin cannot pass
 *      by the entry already holding the seeded values: every target must be
 *      overwritten, and both arms must still agree byte-for-byte.
 *   4. TEETH (wrong control byte) — a twin that seeds a wrong reaction-state byte is
 *      CAUGHT at that byte.
 *   5. TEETH (dropped hand-off) — a twin that does resetReactionState's own writes but drops the
 *      loc_287a tail is CAUGHT (the dig-object block + actor pair are never seeded).
 *
 * The oracle is run on a clone() (frame machinery neutralised) so its internal cycle
 * steps cannot trip a live NMI whose handler would write RAM and masquerade as a side
 * effect.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-24cf.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_24cf as oracle } from "../../translated/loc_24cf.js";
import { resetReactionState as idiomatic } from "../resetReactionState.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import {
  REACTION_STATE,
  REACTION_TIMER,
  HAZARD_STATE,
  BOARD_END_PHASE,
  ENEMY3_X,
  ENEMY3_TWIN_X,
} from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const hx = (v) => "0x" + (v & 0xffff).toString(16);

// resetReactionState's OWN fixed-value writes (address -> value). Every one is a constant, so
// the sentinel/non-vacuous check can assert both overwrite and value. The downstream
// tail chain touches none of these addresses, so they are the whole routine's writes.
const FIXED = [
  [0x8096, 3],
  [0x8094, 0],
  [0x8097, 0],
  [REACTION_STATE, 0], // 0x80a2 — reaction machine idle
  [REACTION_TIMER, 0], // 0x80a4 — reaction step timer cleared
  [0x80a1, 1],
  [0x80a3, 24], // reaction step period
  [0x809c, 1],
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

test("EQUAL: resetReactionState leaves the same work RAM as the oracle over real captured states", () => {
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

// -- 2. TAIL FIRED: the reaction block seeded + the full tail ran -------------

test("TAIL FIRED: the reaction block is seeded and the full tail's effects are present", () => {
  const [entry] = captureStates(1, 1, 175);

  const b = entry.clone();
  idiomatic(b);

  // resetReactionState's own writes.
  for (const [addr, val] of FIXED) {
    assert.equal(b.mem.read8(addr), val, `control byte ${hx(addr)} not seeded`);
  }
  // The tail's effects: loc_287a's dig-object block and the actor-seed tail ran.
  assert.equal(b.mem.read8(HAZARD_STATE), 48, "the tail must seed the dig-object carving-phase state");
  assert.equal(b.mem.read8(ENEMY3_X), 36, "the chain's tail must seed the primary start column");
  assert.equal(b.mem.read8(ENEMY3_TWIN_X), 52, "the chain's tail must seed the twin start column");
  assert.equal(b.mem.read8(BOARD_END_PHASE), 0, "the chain's tail must clear the spawn-phase flag");
  console.log("  TAIL FIRED: reaction block seeded, dig-object + actor seed chain ran");
});

// -- 3. NON-VACUOUS + WRITE-COMPLETE (sentinel entry) -------------------------
// Sentinel 85 is never a value resetReactionState writes (its values are {0,1,3,24}), and the
// downstream tail touches none of these addresses, so a target still holding it means
// it was never written.

test("NON-VACUOUS: with resetReactionState's own targets pre-set to a sentinel, both arms overwrite them and agree", () => {
  const [entry] = captureStates(1, 1, 200);
  const SENTINEL = 85;
  for (const [addr] of FIXED) entry.mem.write8(addr, SENTINEL);

  const a = entry.clone(); // oracle
  const b = entry.clone(); // idiomatic
  oracle(a);
  idiomatic(b);

  for (const [addr] of FIXED) {
    assert.notEqual(b.mem.read8(addr), SENTINEL, `idiomatic left ${hx(addr)} unwritten (still the sentinel)`);
  }
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
  console.log(`  NON-VACUOUS: all ${FIXED.length} control bytes overwritten, arms agree`);
});

// -- 4. TEETH: a wrong control byte is caught ---------------------------------

/** Broken twin A: seeds everything, but the reaction-state byte is wrong. */
function brokenControlByte(m) {
  idiomatic(m);
  m.mem.write8(REACTION_STATE, m.mem.read8(REACTION_STATE) + 1); // BUG: reaction machine not idle
}

test("TEETH (wrong control byte): a wrong reaction-state byte is CAUGHT", () => {
  const caps = captureStates(4, 120, 150);
  let caught = null;
  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // broken twin
    oracle(a);
    brokenControlByte(b);
    const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    if (d) {
      caught = d;
      break;
    }
  }
  assert.notEqual(caught, null, "the gate FAILED to catch a wrong control byte — it proves nothing");
  assert.equal(caught.addr, REACTION_STATE, `teeth caught the wrong address ${hx(caught.addr ?? 0)}`);
  console.log(`  TEETH: wrong control byte caught at ${hx(caught.addr)} (oracle=${caught.a} broken=${caught.b})`);
});

// -- 5. TEETH: a dropped tail hand-off is caught ------------------------------

/** Broken twin B: does resetReactionState's own writes but drops the loc_287a tail hand-off. */
function brokenNoTail(m) {
  const { mem } = m;
  for (const [addr, val] of FIXED) mem.write8(addr, val);
  // BUG: no hand-off — the dig-object block, level parameters, and actor pair are
  // never seeded.
}

test("TEETH (dropped hand-off): dropping the loc_287a tail is CAUGHT", () => {
  const [entry] = captureStates(1, 1, 220);
  // Pre-set a downstream tail write target so a missing hand-off is deterministic.
  const SENTINEL = 85;
  entry.mem.write8(BOARD_END_PHASE, SENTINEL);

  const a = entry.clone(); // oracle (runs the tail)
  const b = entry.clone(); // broken twin (no tail)
  oracle(a);
  brokenNoTail(b);

  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.notEqual(d, null, "the gate FAILED to catch a dropped hand-off — it proves nothing");
  assert.equal(b.mem.read8(BOARD_END_PHASE), SENTINEL, "the broken twin never cleared the spawn-phase flag");
  console.log(`  TEETH: dropped hand-off caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});
