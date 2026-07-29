// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence gate for seedObjectStartState (ROM 0x1362) — the round/play (re)init
 * step that seeds the tracked-object / level state block to its start-of-play
 * defaults (a few fixed non-zero counters, the rest cleared).
 *
 * loc_1362 is entered ONLY from the gameplay round-init chain (initRoundAndEnterMainLoop's pre-play
 * setup calls); attract mode never enters gameplay, so it is never dispatched in a
 * boot/attract run — the unit harness (which needs a real dispatch) cannot capture
 * it. But the routine READS NOTHING: it stores fixed constants into 28 distinct
 * work-RAM bytes, so its output is independent of the entry state and any realistic
 * machine state is a valid entry. This is the CRAFTED-ENTRY path: capture real
 * attract states and run oracle vs idiomatic on independent clones of them.
 *
 * THREE checks:
 *   1. EQUAL (real captured entries) — clone the running attract machine at several
 *      frames (real title/demo RAM), run the oracle and seedObjectStartState on
 *      independent clones of each, and diff work RAM. Must be identical.
 *   2. NON-VACUOUS + WRITE-COMPLETE (sentinel entry) — pre-set all 28 targets to a
 *      sentinel identically on both sides, so a no-op or partial routine cannot pass
 *      by the entry already holding the seeded values: every target must be
 *      overwritten, and both arms must still agree byte-for-byte.
 *   3. TEETH — a twin that seeds correctly but puts the start row one off MUST be
 *      caught. The wrong byte is entry-independent, so it is caught on every state.
 *
 * The oracle is run on a clone() (frame machinery neutralised) so its internal cycle
 * steps cannot trip a live NMI whose handler would write RAM and masquerade as a side
 * effect. seedObjectStartState writes memory directly and steps nothing.
 *
 * Run: node --test games/thepit/idiomatic/test/equivalence-1362.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1362 as oracle } from "../../translated/loc_1362.js";
import { seedObjectStartState } from "../seedObjectStartState.js";
import { makeMachineFactory } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { PLAYER_Y, PLAYER_X, PLAYER_FACING, BOARD_END_PHASE, MOVE_BLOCK_FLAG, NEXT_TILE } from "../ram.js";

const ROM_PATH = new URL("../../rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(ROM_PATH)) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

const hx = (v) => "0x" + (v & 0xffff).toString(16);

// Every byte the routine writes (named where ram.js has a name, hex otherwise).
const TARGET_ADDRS = [
  PLAYER_Y, PLAYER_X, PLAYER_FACING,
  0x806a, 0x806c, 0x806d, 0x8070, 0x8071, 0x8073,
  0x801a, 0x8075, 0x8076, 0x8077, 0x8078, 0x8079, 0x807a,
  BOARD_END_PHASE, 0x807c, 0x807d, 0x807e, 0x807f, MOVE_BLOCK_FLAG, 0x8081, 0x8082,
  0x80a2, 0x80a4, 0x80a7, NEXT_TILE,
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

test("EQUAL: seedObjectStartState leaves the same work RAM as the oracle over real captured states", () => {
  const caps = captureStates(8, 120, 90);
  assert.ok(caps.length >= 1, "expected at least one captured attract state");
  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // idiomatic
    oracle(a);
    seedObjectStartState(b);
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
  seedObjectStartState(b);

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

/** Broken twin: seeds correctly but the tracked-object start row is one off. */
function brokenSeedObjectStartState(m) {
  seedObjectStartState(m);
  m.mem.write8(PLAYER_X, 36); // BUG: start row should be 35
}

test("TEETH: a twin with the start row one off is CAUGHT", () => {
  const caps = captureStates(4, 120, 150);
  let caught = null;
  for (const cap of caps) {
    const a = cap.clone(); // oracle
    const b = cap.clone(); // broken twin
    oracle(a);
    brokenSeedObjectStartState(b);
    const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    if (d) {
      caught = d;
      break;
    }
  }
  assert.notEqual(caught, null, "the gate FAILED to catch a wrong-value twin — it proves nothing");
  assert.equal(caught.addr, PLAYER_X, `teeth caught the wrong address ${hx(caught.addr ?? 0)}`);
  console.log(`  TEETH: caught at ${hx(caught.addr)} (oracle=${caught.a} broken=${caught.b})`);
});
