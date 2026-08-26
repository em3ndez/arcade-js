// SPDX-License-Identifier: GPL-3.0-only
/**
 * SP-DELTA TOOTH — self-proving test for the per-routine stack-placement check (core seamPlaceable).
 *
 * The missing-push16 class is invisible to a memory-equivalence gate (the adrift stack word lives in dead
 * stack scratch, excluded from the RAM diff), so a rewrite that drops `m.push16(<slot>)` before an rst-28 /
 * tail dispatch passes eq-green while corrupting the live game. seamPlaceable runs the rewrite through the
 * game's dispatch seam (withOmittedRet) — which THROWS when SP is adrift — so the class is caught per routine.
 *
 * This test NULL-MUTANTS the tooth (prime's rule: a check that cannot fail proves nothing):
 *   A. a converted switch-form dispatcher (advanceLeadActorPrimaryState) is PLACEABLE (moved 0, no false positive);
 *   B. a synthetic rst-28 dispatch (advanceLeadActorPrimaryState's pre-conversion form) with its push16 DROPPED is NOT placeable (the tooth's teeth — it goes RED);
 *   C. the dispatcher's plain-return abort arm (SP moved 0) is placeable (the seam completes the ret);
 *   D. a leaf rewrite (enqueueSoundCommandRing, no stack ops) is placeable (no false positive on a leaf).
 *
 * Run: node --test games/pooyan/idiomatic/test/sp-seam-tooth.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { advanceLeadActorPrimaryState } from "../advanceLeadActorPrimaryState.js";
import { runLaunchAndTargetActorPipeline } from "../runLaunchAndTargetActorPipeline.js";
import { loc_25a6 } from "../loc_25a6.js";
import { loc_308b } from "../loc_308b.js";
import { enqueueSoundCommandRing } from "../enqueueSoundCommandRing.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { TAMPER_FREEZE_FLAG, ACTOR_TABLE, ACTOR_GROUP_STATE_DISPATCH, SOUND_RING_WRITE_PTR } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/pooyan rom'" }, fn);

const STATE = 0x8a82; //  lead record state byte (ACTOR_TABLE + 2); low 3 bits = dispatch index
const DELAY = 0x8a91; //  lead record frame-delay byte; the state-1 handler ticks it
const REC7 = 0x8a87; //  lead record +7; bit4 clear -> minimal sub-pass one
const HUNTER_GATE = 0x8f04;
const ROPE_GATE = 0x8907;
const ROPE_TIMER = 0x8f09;
const LAUNCH_STATE = 0x8f30;
const SP0 = 0x8ff0; //          inside STACK_SCRATCH
const CALLER_RET = 0xfffc; //   sentinel return word seated at SP0: the correct dispatch rets here (pc==this,
//                              moved +2 -> placeable); the mutant pops it as a table base -> unmapped -> RED.

const BASE = ROM_PRESENT ? new Machine(ROM).clone() : null;

/** Fresh entry clone: sub-passes on benign arms, state-1 dispatch seated, a caller-return word at SP0. */
function craft(freeze) {
  const m = BASE.clone();
  m.regs.sp = SP0;
  m.mem.write16(SP0, CALLER_RET); // the caller's return word the dispatch/seam consumes
  m.mem8[TAMPER_FREEZE_FLAG] = freeze & 0xff;
  m.mem8[STATE] = 0x01; // dispatch index 1 -> frame-delay handler
  m.mem8[DELAY] = 0x05; // running -> handler decrements and returns
  m.mem8[REC7] = 0x00;
  m.mem8[HUNTER_GATE] = 0x00; // hunter pass gated off
  m.mem8[ROPE_GATE] = 0x01; // rope pass: bit0 set -> timer path
  m.mem8[ROPE_TIMER] = 0x05; // rope timer running -> dec + ret
  m.mem8[LAUNCH_STATE] = 0x00;
  return m;
}

/** A synthetic rst-28 dispatch (advanceLeadActorPrimaryState's pre-conversion form) with the push16 DROPPED — the missing-push16 bug the tooth must catch. */
function loc_241e_missingPush(m) {
  const { mem8 } = m;
  runLaunchAndTargetActorPipeline(m);
  loc_25a6(m);
  loc_308b(m);
  if (mem8[TAMPER_FREEZE_FLAG] !== 0) return;
  m.regs.ix = ACTOR_TABLE;
  m.regs.a = mem8[ACTOR_TABLE + 0x02] & 0x07;
  // BUG: missing m.push16(ACTOR_GROUP_STATE_DISPATCH) — the dispatcher pops the caller's slot instead.
  return m.call(0x0028);
}

// -- A. no false positive on a correct legit-+2 dispatcher --------------------
test("PLACEABLE: advanceLeadActorPrimaryState (switch form) is placeable — moved 0, no false positive", () => {
  const r = seamPlaceable(withOmittedRet, advanceLeadActorPrimaryState, 0x241e, craft(0x00));
  assert.equal(r.placeable, true, `correct dispatcher must be seam-placeable; got: ${r.error}`);
  console.log("  PLACEABLE: advanceLeadActorPrimaryState switch form (moved 0, seam supplies the ret)");
});

// -- B. THE TEETH: null-mutant (missing push16) goes RED ----------------------
test("TEETH: advanceLeadActorPrimaryState with the push16 DROPPED is NOT placeable (a check that cannot fail proves nothing)", () => {
  const r = seamPlaceable(withOmittedRet, loc_241e_missingPush, 0x241e, craft(0x00));
  assert.equal(r.placeable, false,
    "the tooth FAILED to catch a missing push16 — it is worthless (memory-eq is blind to this class)");
  console.log(`  TEETH: missing-push16 mutant caught — not placeable (${(r.error || "").slice(0, 60)}...)`);
});

// -- C. no false positive on a plain-return arm (SP moved 0) ------------------
test("PLACEABLE: advanceLeadActorPrimaryState abort arm (freeze set, plain return) — the seam completes the omitted ret", () => {
  const r = seamPlaceable(withOmittedRet, advanceLeadActorPrimaryState, 0x241e, craft(0x01));
  assert.equal(r.placeable, true, `plain-return arm must be seam-placeable; got: ${r.error}`);
  console.log("  PLACEABLE: advanceLeadActorPrimaryState abort arm (moved 0, seam supplies the ret)");
});

// -- D. no false positive on a leaf (no stack ops) ---------------------------
test("PLACEABLE: a leaf rewrite (enqueueSoundCommandRing) — moved 0, no false positive", () => {
  const m = BASE.clone();
  m.regs.sp = SP0;
  m.mem.write16(SP0, CALLER_RET);
  m.mem8[SOUND_RING_WRITE_PTR] = 0x50; // a valid ring cursor
  const r = seamPlaceable(withOmittedRet, enqueueSoundCommandRing, 0x0eb3, m);
  assert.equal(r.placeable, true, `leaf must be seam-placeable; got: ${r.error}`);
  console.log("  PLACEABLE: leaf enqueueSoundCommandRing (moved 0, seam supplies the ret)");
});
