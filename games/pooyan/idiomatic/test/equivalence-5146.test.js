// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence + SP-tooth test for loc_5146 (ROM 0x5146, Pooyan) — the boot-frontier
 * trampoline: run loc_5150, loc_52f6, loc_5334 in order and return. All three passes are dissolved
 * to direct calls.
 *
 * loc_5146 is void — no register survives — so the register file is not compared; equivalence is
 * RAM (dumpState) minus STACK_SCRATCH via firstStateDiff, SP parked in dead stack. The craft arms
 * the slot-sweep (advance guard set, sweep latch clear, enemy slots empty) so loc_52f6 does real
 * work — an observable write the trampoline is responsible for invoking.
 *
 * loc_5146 dissolved its trampolines to direct calls, so it nets SP zero. As a wired override it
 * carries an SP-TOOTH (reviewer-rules R36): the correct routine is seam-placeable (SP nets zero, the
 * seam completes the omitted ret), and a synthetic variant with a push16 DROPPED is not (the
 * invisible-to-memory-eq missing-push16 class the seam catches).
 *
 * Jobs:
 *   1. EQUAL — oracle == loc_5146 in RAM (−stack): the idiomatic middle pass matches the frozen one.
 *   2. WRITE-SET — the trampoline runs loc_52f6, which latches the free-slot count.
 *   3. TEETH — a wrong sweep-latch byte is CAUGHT by the RAM diff.
 *   4. SP-TOOTH — placeable when correct; NOT placeable with a dropped push16.
 *
 * Run: node --test games/pooyan/idiomatic/test/equivalence-5146.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_5146 as oracle } from "../../translated/loc_5146.js";
import { loc_5146 } from "../loc_5146.js";
import { loc_52f6 } from "../loc_52f6.js";
import { Machine, withOmittedRet } from "../../machine.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH } from "../names.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/pooyan rom'" }, fn);

const SCRIPT_ADVANCE_GUARD = 0x8d6d; // set -> loc_5150 bails, loc_52f6 sweeps
const SLOT_SWEEP_LATCH = 0x8d6e; //     loc_52f6 latches the free-slot count here
const SP0 = 0x8ff0; //                  inside STACK_SCRATCH
const CALLER_RET = 0xabcd; //           the caller's return word the seam completes

const hx = (v) => "0x" + (v & 0xffff).toString(16);
const inDeadStack = (addr) => addr != null && addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi;
const BASE = ROM_PRESENT ? new Machine(ROM).clone() : null;

function ramDiffMinusStack(ma, mb) {
  return firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);
}

/** Arm the slot-sweep so the middle pass does real work; seat a caller-return word for the seam. */
function craft() {
  const m = BASE.clone();
  m.regs.sp = SP0;
  m.mem.write16(SP0, CALLER_RET);
  m.mem8[SCRIPT_ADVANCE_GUARD] = 0x05; // guard set: 5150 bails, 52f6 sweeps, latch still clear
  return m;
}

/** A synthetic trampoline with a push16 DROPPED — the missing-push16 bug seamPlaceable must catch. */
function loc_5146_missingPush(m) {
  m.call(0x5150); // BUG: missing m.push16(0x5149) — the callee's ret pops the caller's slot
  loc_52f6(m);
  m.push16(0x514f); m.call(0x5334);
}

// -- 1. EQUAL -----------------------------------------------------------------

test("EQUAL: loc_5146 == oracle in RAM (−stack)", () => {
  const o = craft();
  oracle(o);
  const c = craft();
  loc_5146(c);
  const d = ramDiffMinusStack(o, c);
  assert.equal(d, null, d && `RAM diff at ${hx(d.addr ?? 0)}: oracle=${d.a} module=${d.b}`);
  console.log("  EQUAL: trampoline identical (RAM −stack)");
});

// -- 2. WRITE-SET -------------------------------------------------------------

test("WRITE-SET: the trampoline runs loc_52f6 (latches the free-slot count)", () => {
  const before = craft().mem8[SLOT_SWEEP_LATCH];
  const c = craft();
  loc_5146(c);
  assert.equal(before, 0x00, "sweep latch clear before the run");
  assert.equal(c.mem8[SLOT_SWEEP_LATCH], 0x06, "loc_52f6 latched all six empty slots");
  console.log("  WRITE-SET: sweep latch 0x00 -> 0x06 (loc_52f6 invoked)");
});

// -- 3. TEETH -----------------------------------------------------------------

test("TEETH: a wrong sweep-latch byte is CAUGHT by the RAM diff", () => {
  const o = craft();
  const c = craft();
  oracle(o);
  loc_5146(c);
  c.mem8[SLOT_SWEEP_LATCH] = 0x00; // BUG: the sweep must have latched 0x06
  const d = ramDiffMinusStack(o, c);
  assert.notEqual(d, null, "the gate FAILED to catch a wrong sweep latch — it is worthless");
  assert.equal(d.addr, SLOT_SWEEP_LATCH, `teeth caught wrong address ${hx(d.addr ?? 0)}`);
  console.log(`  TEETH/RAM: wrong sweep latch caught at ${hx(d.addr)} (oracle=${d.a} broken=${d.b})`);
});

// -- 4. SP-TOOTH --------------------------------------------------------------

test("SP-TOOTH: correct loc_5146 is seam-placeable; a dropped push16 is NOT", () => {
  const ok = seamPlaceable(withOmittedRet, loc_5146, 0x5146, craft());
  assert.equal(ok.placeable, true, `correct trampoline must be seam-placeable; got: ${ok.error}`);

  const bad = seamPlaceable(withOmittedRet, loc_5146_missingPush, 0x5146, craft());
  assert.equal(bad.placeable, false,
    "the SP-tooth FAILED to catch a missing push16 — it is worthless (memory-eq is blind to this class)");
  console.log(`  SP-TOOTH: correct placeable; missing-push16 caught (${(bad.error || "").slice(0, 50)}...)`);
});
