// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence test for dispatchBoardBuildSubstate (ROM 0x0c4e, Pooyan) — the board-build state dispatcher.
 *
 * Seats its own post-dispatch continuation (0x0d78) as the handler return, marshals the play-state
 * index, dispatches through the shared rst-0x28 trampoline into the inline table {0->0c5c, 1->0c77,
 * 2->0d61}, then runs the continuation which returns to the caller. Both oracle and module drive the
 * SAME frozen spine + handler; only the continuation differs (frozen vs idiomatic startSelectedPlayerGameConsumingCredits), so
 * equivalence is RAM (dumpState) minus STACK_SCRATCH.
 *
 * The crafted state seats sub-state 0 (primeTileFillCursorAndAdvanceBoardBuild: clear scratch, seat the fill cursor, bump the
 * sub-state, clear the board-init RAM) — a self-contained handler whose memory footprint is stable.
 *
 * Jobs:
 *   1. EQUAL — oracle == module in RAM (−stack).
 *   2. WRITE-SET — the dispatch reaches primeTileFillCursorAndAdvanceBoardBuild: the sub-state is bumped 0 -> 1.
 *   3. TEETH — a corrupted post-run byte is CAUGHT by the RAM diff.
 *   4. SP-TOOTH (R36) — the seated-return + rst-28 dispatch is seam-placeable.
 *
 * Run: node --test games/pooyan/idiomatic/test/equivalence-0c4e.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0c4e as oracle } from "../../translated/loc_0c45.js";
import { dispatchBoardBuildSubstate } from "../dispatchBoardBuildSubstate.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH, PLAY_STATE_INDEX } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/pooyan rom'" }, fn);

const SP0 = 0x8fe0; //        inside STACK_SCRATCH
const CALLER_RET = 0xfffc; // the continuation's ret lands pc here (moved +2 / or completed by the seam)
const STATE_0 = 0x00; //      dispatch -> primeTileFillCursorAndAdvanceBoardBuild

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const inDeadStack = (addr) => addr != null && addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi;
const BASE = ROM_PRESENT ? new Machine(ROM).clone() : null;

function ramDiffMinusStack(ma, mb) {
  return firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);
}

/** A fresh clone: the dispatch index seated, a caller-return word parked at SP0. */
function craft(state = STATE_0) {
  const m = BASE.clone();
  m.regs.sp = SP0;
  m.mem.write16(SP0, CALLER_RET);
  m.mem8[PLAY_STATE_INDEX] = state & 0xff;
  return m;
}

// -- 1. EQUAL -----------------------------------------------------------------

test("EQUAL: dispatchBoardBuildSubstate == oracle in RAM (−stack)", () => {
  const o = craft();
  oracle(o);
  const c = craft();
  dispatchBoardBuildSubstate(c);
  const d = ramDiffMinusStack(o, c);
  assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} module=${d.b}`);
  console.log("  EQUAL: state-0 dispatch identical (RAM −stack)");
});

// -- 2. WRITE-SET -------------------------------------------------------------

test("WRITE-SET: the dispatch reaches primeTileFillCursorAndAdvanceBoardBuild (sub-state bumped 0 -> 1)", () => {
  const o = craft();
  oracle(o);
  assert.equal(o.mem8[PLAY_STATE_INDEX], 0x01, "state-0 handler ran -> sub-state advanced to 1");
  console.log("  WRITE-SET: sub-state 0 dispatch reached primeTileFillCursorAndAdvanceBoardBuild");
});

// -- 3. TEETH -----------------------------------------------------------------

test("TEETH: a corrupted post-run byte is CAUGHT by the RAM diff", () => {
  const o = craft();
  const c = craft();
  oracle(o);
  dispatchBoardBuildSubstate(c);
  c.mem8[PLAY_STATE_INDEX] = (o.mem8[PLAY_STATE_INDEX] ^ 0xff) & 0xff;
  const d = ramDiffMinusStack(o, c);
  assert.notEqual(d, null, "the gate FAILED to catch a corrupted byte");
  assert.equal(d.addr, PLAY_STATE_INDEX, `teeth caught wrong address ${hx(d.addr ?? 0)}`);
  console.log(`  TEETH(RAM): caught at ${hx(d.addr)}`);
});

// -- 4. SP-TOOTH (R36) --------------------------------------------------------

test("SP-TOOTH: dispatchBoardBuildSubstate's seated-return + rst-28 dispatch is seam-placeable", () => {
  const r = seamPlaceable(withOmittedRet, dispatchBoardBuildSubstate, 0x0c4e, craft());
  assert.equal(r.placeable, true, `dispatcher must be seam-placeable; got: ${r.error}`);
  console.log("  SP-TOOTH: dispatch + continuation seat cleanly");
});
