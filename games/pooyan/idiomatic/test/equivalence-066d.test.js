// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence + SP-tooth for loc_066d (ROM 0x066d, Pooyan) — the vblank NMI service routine,
 * the game's sole per-frame heartbeat. The oracle saves the full register file, does its per-frame work
 * (scroll rebuild, input edge-ring, frame counters, coin/sound service, state dispatch), and restores the
 * file; the born-live main loop holds no CPU registers, so the module drops the save/restore and keeps its
 * scratch in JS locals. The rst-28 state dispatch (table 0x06f0) becomes a switch.
 *
 * ENTRY: the NMI runs a whole frame of game logic through the state dispatch, so a raw power-on clone is
 * not a valid entry (uninitialised state dereferences null). We boot the idiomatic engine (with the real
 * overrides) to a mid-attract frame and capture that as the entry, then run the oracle and module NMI on
 * identical copies of it.
 *
 * Jobs:
 *   1. EQUAL — on the booted clone, oracle == module in RAM (−stack): the NMI's whole per-frame write-set
 *      (IO latches, input ring, counters, and the dispatched state handler's effects) matches, proving the
 *      dropped register save/restore and the switch-for-rst28 change nothing observable.
 *   2. SP-TOOTH — the module is SP-neutral through the game's withOmittedRet dispatch seam (it does no
 *      stack ops; the seam supplies the ret). Null-mutant coverage for the seam is in sp-seam-tooth.test.js.
 *
 * The heartbeat's full per-state dispatch across boot/attract/play is exercised every frame by tape.test.js.
 *
 * Run: node --test games/pooyan/idiomatic/test/equivalence-066d.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_066d as oracle } from "../../translated/loc_066d.js";
import { loc_066d } from "../loc_066d.js";
import { Machine, resolveAllIdiomatic, withOmittedRet } from "../../machine.js";
import { runIdiomaticGame } from "../../../../core/frame-stepped.js";
import { firstStateDiff, seamPlaceable } from "../../../../core/equivalence.js";
import { STACK_SCRATCH } from "../names.js";
import manifest from "../../manifest.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built" }, fn);

const nmiReturnPC = manifest.convergence.idiomatic.nmiReturnPC;
const AT = 90; //              a mid-attract frame — booted, valid state, safe dispatch
const SP0 = 0x8fe0; //         inside STACK_SCRATCH — the oracle's 12 register pushes land in dead scratch
const RET = 0xfffc; //         a caller-return word seeded at SP0 for the oracle's final ret to pop
const inDeadStack = (addr) => addr != null && addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi;

// Boot the born-live engine (real overrides) once to a mid-attract frame; that valid state is the entry.
let SNAP = null;
if (ROM_PRESENT) {
  const overrides = await resolveAllIdiomatic();
  const boot = new Machine(ROM, { overrides });
  runIdiomaticGame(boot, {
    bootAddr: 0x0000, nmiReturnPC, maxFrames: AT + 1,
    onFrame: (m, f) => { if (f === AT) SNAP = m.clone(); },
  });
}
function forNmi() {
  const m = SNAP.clone(); m.regs.sp = SP0; m.mem.write16(SP0, RET); return m;
}
function ramDiffMinusStack(ma, mb) {
  return firstStateDiff(ma.dumpState(), mb.dumpState(), (off) => ma.stateOffsetToAddr(off), inDeadStack);
}

test("EQUAL: booted clone — module == oracle in RAM (−stack)", () => {
  assert.ok(SNAP, "boot reached the capture frame");
  const o = forNmi();
  const c = forNmi();
  oracle(o);
  loc_066d(c);
  const d = ramDiffMinusStack(o, c);
  assert.equal(d, null, d && `RAM diff at 0x${(d.addr ?? 0).toString(16)}: oracle=${d.a} module=${d.b}`);
  console.log("  EQUAL booted clone: one NMI frame, RAM identical");
});

test("SP-TOOTH: the NMI places SP-neutral through the withOmittedRet seam", () => {
  const { placeable, error } = seamPlaceable(withOmittedRet, loc_066d, 0x066d, forNmi());
  assert.equal(placeable, true, error || "loc_066d must place SP-neutral (no stack ops; seam supplies the ret)");
  console.log("  SP-TOOTH: placeable === true");
});
