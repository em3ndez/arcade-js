// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence gate for seedActorSpawnState (ROM 0x36fe) — the round/level init step
 * that seeds the primary+twin actor records and clears the spawn-phase flag.
 *
 * loc_36fe is entered ONLY by the gameplay round-init tail-jump chain
 * (loc_2f2f → seedObjectRecords → loc_36fe); attract mode never enters gameplay, so it is
 * never dispatched in a boot/attract run — the unit harness (which requires a real
 * dispatch) cannot capture it. But the routine READS NOTHING: it stores fixed
 * immediates into fifteen distinct work-RAM bytes. Its output is therefore
 * independent of the entry state, so any realistic machine state is a valid entry.
 * This is the CRAFTED-ENTRY path: capture real attract states and run oracle vs
 * idiomatic on them.
 *
 * THREE checks:
 *   1. EQUAL (real captured entries) — clone the running attract machine at several
 *      frames (real title/demo RAM), run the oracle and seedActorSpawnState on
 *      independent clones of each, and diff work RAM. Must be identical.
 *   2. NON-VACUOUS + WRITE-COMPLETE (sentinel entry) — pre-set all fifteen targets to
 *      a sentinel identically on both sides, so a no-op or partial twin cannot pass by
 *      the entry already holding the seeded values: every target must be overwritten,
 *      and both arms must still agree byte-for-byte.
 *   3. TEETH — a twin that seeds correctly but puts the primary start column one off
 *      MUST be caught. The wrong byte is entry-independent, so it is caught on every
 *      captured state.
 *
 * The oracle is run on a clone() (frame machinery neutralised) so its internal cycle
 * steps cannot trip a live NMI whose handler would write RAM and masquerade as a side
 * effect. seedActorSpawnState writes memory directly and steps nothing.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-36fe.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_36fe as oracle } from "../../translated/loc_36fe.js";
import { seedActorSpawnState } from "../seedActorSpawnState.js";
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

const TARGET = 0x36fe;
const hx = (v) => "0x" + (v & 0xffff).toString(16);

// Every byte the routine writes (named where ram.js has a name, hex otherwise).
const TARGET_ADDRS = [
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

test("EQUAL: seedActorSpawnState leaves the same work RAM as the oracle over real captured states", () => {
  const caps = captureStates(8, 120, 90);
  assert.ok(caps.length >= 1, "expected at least one captured attract state");
  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // idiomatic
    oracle(a);
    seedActorSpawnState(b);
    const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      d,
      null,
      d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`,
    );
  }
  console.log(`  EQUAL: ${caps.length} real captured attract states — work RAM identical to the oracle`);
});

// -- 2. NON-VACUOUS + WRITE-COMPLETE (sentinel entry) -------------------------

test("NON-VACUOUS: with every target pre-set to a sentinel, both arms overwrite all of them and agree", () => {
  const [entry] = captureStates(1, 1, 200);
  const SENTINEL = 0x55;
  for (const addr of TARGET_ADDRS) entry.mem.write8(addr, SENTINEL);

  const a = entry.clone(); // oracle
  const b = entry.clone(); // idiomatic
  oracle(a);
  seedActorSpawnState(b);

  for (const addr of TARGET_ADDRS) {
    assert.notEqual(
      b.mem.read8(addr),
      SENTINEL,
      `idiomatic left ${hx(addr)} unwritten (still the sentinel)`,
    );
  }
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} idiomatic=${d.b}`);
  console.log(`  NON-VACUOUS: all ${TARGET_ADDRS.length} targets overwritten from the sentinel, arms agree`);
});

// -- 3. TEETH: a wrong-value twin MUST be caught ------------------------------

/** Broken twin: seeds correctly but the primary start column is one off. */
function brokenSeedActorSpawnState(m) {
  seedActorSpawnState(m);
  m.mem.write8(ENEMY3_X, 37); // BUG: start column should be 36
}

test("TEETH: a twin with the primary start column one off is CAUGHT", () => {
  const caps = captureStates(4, 120, 150);
  let caught = null;
  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // broken twin
    oracle(a);
    brokenSeedActorSpawnState(b);
    const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    if (d) {
      caught = d;
      break;
    }
  }
  assert.notEqual(caught, null, "the gate FAILED to catch a wrong-value twin — it proves nothing");
  assert.equal(caught.addr, ENEMY3_X, `teeth caught the wrong address ${hx(caught.addr ?? 0)}`);
  console.log(`  TEETH: caught at ${hx(caught.addr)} (oracle=${caught.a} broken=${caught.b})`);
});
