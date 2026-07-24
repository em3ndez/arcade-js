// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for descend_2284 (loc_2259's "one pixel DOWN" step: bump
 * MARIO_Y, call sub_3fc0, bump the sprite-Y byte sub_3fc0 leaves HL pointing at). A
 * LEAF -- not a dispatch target -- reached only via `m.call(0x2284)` from loc_2259,
 * which sub_2207_body dispatches from the INTERRUPTIBLE per-frame update cascade
 * loc_197a (@0x199B, via the rst-0x30 gate that opens only when BOARD (0x6227) == 2).
 *
 * REACHING IT. descend_2284 fires in NEITHER attract NOR plain gameplay (probed 3000
 * attract + 2000 gameplay frames: 0 dispatches) -- its confluence is deep: BOARD==2,
 * the 0x6280/0x6288 object record in state 1 with its base+4 timer at 0, sub_2243's
 * hit test passing (MARIO_Y<0x7a, (0x6216)==0, MARIO_X==record base+2), and then
 * MARIO_Y<0x68 or odd. So it is reached the sanctioned third way (docs/06): an
 * IDENTICAL-BOTH-SIDES poke of exactly that confluence, applied to baseline AND
 * override through the shared factory, so the game's OWN dispatch runs the routine.
 * Under that poke it is dispatched ~1x (frame ~1163), healthy.
 *
 * THE CYCLE DECISION this routine records: descend_2284 is KEPT PER-INSTRUCTION (its
 * charges are NOT collapsed; 10, 11, 17[call], 11, 10[ret] -- own total 59 t, whole
 * total 97 t incl. sub_3fc0's 38 t). It is reached ONLY through the interruptible
 * 0x197a cascade, so the vblank NMI can land inside it on that path -- docs/06's
 * atomicity rule keeps such a routine per-instruction. AND a collapse here is one the
 * whole-machine gate CANNOT license: it is dispatched ~1x under the poke, and a single
 * wrong total does not fork the PRNG persistently under that heavy poking, so the
 * convergent gate does NOT catch a cycle-broken twin on this trajectory (measured --
 * see the note on the CONVERGENT test). That is docs/06's per-instruction frontier
 * case ("a collapse it can't whole-machine verify, kept per-instruction"). The
 * reliable TEETH are therefore at the UNIT level, on a REAL DISPATCHED entry (stronger
 * than the synthesised entry the frontier pattern settles for).
 *
 * Five jobs:
 *
 *   1. CONVERGENT (whole-machine) -- a DISPATCH + CONVERGENCE demonstration. The
 *      per-instruction rewrite is byte-identical to the oracle, so a full poke-driven
 *      run with the override installed CONVERGES (0 tears, 0 persistent divergence)
 *      and the override actually FIRES (>=1), proving the game's own dispatch runs
 *      this rewrite -- i.e. it is reachable-in-principle, not a dead frontier. NOTE:
 *      this gate carries no cycle TEETH here (a cycle-broken twin is NOT caught -- one
 *      firing under the poke does not fork the PRNG persistently); the teeth live in
 *      jobs 4-5.
 *   2. EQUAL (unit) -- oracle vs optimized leave identical RAM + full register file
 *      (incl. F and the HL sub_3fc0 clobbers) + pc, from the REAL captured entry.
 *   3. CONTRACT + CYCLE + HL-CLOBBER -- descend_2284 has NO data-dependent branch (one
 *      straight-line path through one call), so there is one arm. It is proven EQUAL
 *      across the whole contract (RAM + regs + pc + SP), its cycle TOTAL pinned at 97 t,
 *      AND its SEMANTICS asserted directly: MARIO_Y (0x6205) += 1 (exactly once, +1 not
 *      +2), (0x694d) := 3, and the sprite-Y byte (0x694f) += 1 -- which is the proof
 *      that the SECOND `inc (hl)` follows sub_3fc0's clobbered HL (0x694f), not MARIO_Y.
 *   4. BRANCH-TEETH (cycles) -- a twin that drops 5 t yields 92 != 97 and is CAUGHT,
 *      proving the cycle-total assertion has teeth.
 *   5. TEETH (unit, value) -- a twin whose FIRST store (to MARIO_Y, 0x6205) lands the
 *      wrong value (XOR 0xFF) is CAUGHT: NOT-EQUAL, naming 0x6205.
 *
 * NO write-trace test: the only stores are MARIO_Y (0x6205), (0x694d) and (0x694f),
 * all WORK RAM (0x6000-0x6BFF), not 0x7Dxx hardware latches -- nothing on the emit.js
 * --writes trace, so there is no hardware bus cycle to pin.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { descend_2284 as translated_2284 } from "../../translated/state0.js";
import { descend_2284 as optimized_2284 } from "../descend_2284.js";
import { convergentGate } from "./convergent.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { Machine } from "../../machine.js";
import { MARIO_Y } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2284;
const CAPTURE_FRAMES = 1250; // the poke confluence dispatches descend_2284 at frame ~1163
const PINNED_CYCLES = 97;    // descend_2284's own 59 t + sub_3fc0's 38 t (both deterministic)

// The sprite-record bytes sub_3fc0 touches / this routine's second inc bumps. They are
// SCRATCH_* in ram.js (only MARIO_SPRITE_RECORD 0x694C itself is named), so they stay
// hex here: +1 = sprite CODE, +3 = sprite Y of the record based at 0x694C.
const SPRITE_CODE = 0x694d; // sub_3fc0 writes 0x03 here
const SPRITE_Y = 0x694f;    // the byte the SECOND inc (hl) bumps (HL after sub_3fc0)

// -- reaching descend_2284: the identical-both-sides poke confluence ----------
// Held from frame 300 (past the coin+start into gameplay) so the game's own dispatch
// runs the routine. BOARD==2 opens sub_2207's rst-0x30 gate; state=1 selects loc_2259;
// base+4 timer=1 lets it fall through; MARIO_X==record base+2 (both 0x50) + (0x6216)=0
// + MARIO_Y<0x7a pass sub_2243's hit test; MARIO_Y (0x40) < 0x68 takes the descend arm.
const held = (addr, val) => ({ addr, val, frame: 300, dur: null });
const POKE_SCENARIO = {
  frames: CAPTURE_FRAMES,
  inputs: [
    { port: 0x7d00, bits: 0x80, frame: 100, dur: 1 }, // coin
    { port: 0x7d00, bits: 0x04, frame: 160, dur: 1 }, // start
  ],
  pokes: [
    held(0x6227, 2),                    // BOARD == 2 (opens the sub_2207 gate)
    held(0x6280, 1), held(0x6288, 1),   // both parity records -> state 1 (loc_2259)
    held(0x6284, 1), held(0x628c, 1),   // base+4 timer -> 1 (dec to 0, fall through)
    held(MARIO_Y, 0x40),                // MARIO_Y < 0x68 and < 0x7a -> descend arm
    held(0x6216, 0),                    // sub_2243 hit-test gate
    held(0x6203, 0x50),                 // MARIO_X ...
    held(0x6282, 0x50), held(0x628a, 0x50), // ... == record base+2 (sub_2243 match)
  ],
};

/**
 * Deliberately-broken twin: behaviourally the optimized routine EXCEPT the FIRST
 * store (to MARIO_Y, 0x6205) lands a wrong value (XOR 0xFF, guaranteed to differ).
 * The call and the second inc still run verbatim -- catches a "wrong value to the
 * routine's own output byte" bug.
 */
function broken_2284(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke) {
      broke = true;
      return realWrite(addr, value ^ 0xff, busOffset);
    }
    return realWrite(addr, value, busOffset);
  };
  try {
    return optimized_2284(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

/**
 * Cycle-broken twin: identical memory + registers to the routine, but the post-call
 * `inc (hl)` charge is 5 t short (6 instead of 11), so the path total is 92 not 97.
 * Teeth for the cycle-total assertion (job 4). This is NOT run through the whole-machine
 * gate -- one firing under the poke does not fork the PRNG persistently, so the
 * convergent gate cannot catch it (that is *why* the routine is kept per-instruction).
 */
function cyclebroken_2284(m) {
  const { regs, mem } = m;
  regs.hl = MARIO_Y;
  m.step(0x2284, 10);
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
  m.step(0x2285, 11);
  m.push16(0x2288); m.step(0x3fc0, 17); m.call(0x3fc0);
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
  m.step(0x2289, 6); // DROPPED: the correct charge here is 11 t
  m.ret(10);
}

/** Capture the pristine machine the instant descend_2284 is first entered (via
 *  m.call) under the poke confluence. A constructor override snapshots the entry,
 *  then delegates to the oracle so the host run proceeds normally to a clean stop. */
function captureEntry(maxFrames = CAPTURE_FRAMES) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_2284(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.inputTape = POKE_SCENARIO.inputs.map((x) => ({ ...x }));
  host.pokes = POKE_SCENARIO.pokes.map((x) => ({ ...x }));
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}

/** Clone `entry`, run `fn`, and report the full contract: SP, PC, the machine, and
 *  the cycles the routine charged (relative to entry, so it is base-independent). */
function runFrom(entry, fn) {
  const c = entry.clone();
  const c0 = c.cycles;
  const ret = fn(c);
  return { ret, cycles: c.cycles - c0, sp: c.regs.sp, pc: c.pc, machine: c };
}

// -- CONVERGENT (whole-machine): dispatch + convergence demonstration ---------

test("CONVERGENT (whole-machine): poke-dispatched descend_2284 FIRES and CONVERGES vs translated", () => {
  // descend_2284 fires in neither attract nor plain gameplay, so it is reached the
  // sanctioned third way: an identical-both-sides poke of the board-2 confluence,
  // applied to both engines through the shared factory. The per-instruction rewrite is
  // byte-identical, so the run converges cleanly; the point of this gate is to prove
  // the game's OWN dispatch runs the rewrite (fired >= 1) -- reachable, not a dead
  // frontier. The reliable TEETH are the unit-level jobs below (a cycle-broken twin is
  // NOT caught here -- one firing does not fork the PRNG persistently under the poke).
  const r = convergentGate(new Map([[TARGET, optimized_2284]]), { scenario: POKE_SCENARIO });

  assert.ok(
    r.invocations.get(TARGET) >= 1,
    `override at 0x${TARGET.toString(16)} never dispatched (invocations=${r.invocations.get(TARGET)})`,
  );
  assert.equal(
    r.pass,
    true,
    r.pass ? "" : `NOT convergent: persistent state ${JSON.stringify(r.statePersistent)}, ` +
      `pixelPersistent=${r.pixelPersistent}`,
  );
  console.log(
    `  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x; ` +
      `${r.pixDiffFrames} tear frame(s) (max ${r.maxPixels}px), ` +
      `non-stack state persistent = ${r.statePersistent.length}`,
  );
});

// -- EQUAL (unit) ------------------------------------------------------------

test("EQUAL (unit): idiomatic optimized descend_2284 matches translated in RAM + registers", () => {
  const entry = captureEntry();
  const o = runFrom(entry, translated_2284);
  const p = runFrom(entry, optimized_2284);

  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(o.machine.regs, p.machine.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(o.pc, p.pc, "pc must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F, HL=0x694f, SP) + pc identical (real dispatched entry)");
});

// -- CONTRACT + CYCLE + HL-CLOBBER -------------------------------------------

test("CONTRACT (unit): single path -- EQUAL, cycle total 97 t, and the HL-clobber semantics", () => {
  const entry = captureEntry();
  const y0 = entry.mem.read8(MARIO_Y);
  const sy0 = entry.mem.read8(SPRITE_Y);

  const o = runFrom(entry, translated_2284);
  const p = runFrom(entry, optimized_2284);

  // Whole-contract EQUAL (RAM + regs + pc + SP).
  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(o.machine.regs, p.machine.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(o.pc, p.pc, "pc must match between oracle and optimized");
  assert.equal(o.sp, p.sp, "SP must match the oracle");

  // Cycle total: == oracle, and pinned absolute (structural teeth).
  assert.equal(o.cycles, p.cycles, "cycle total must match the oracle");
  assert.equal(o.cycles, PINNED_CYCLES, `oracle cycle total should be ${PINNED_CYCLES} t`);

  // SEMANTICS -- the proof that the two inc (hl) hit DIFFERENT bytes (the HL-clobber):
  //   MARIO_Y bumped EXACTLY ONCE (+1, not +2); sprite code stamped 3; sprite Y bumped.
  assert.equal(p.machine.mem.read8(MARIO_Y), (y0 + 1) & 0xff, "MARIO_Y must be +1 (not +2)");
  assert.equal(p.machine.mem.read8(SPRITE_CODE), 0x03, "sub_3fc0 must set (0x694d) = 3");
  assert.equal(p.machine.mem.read8(SPRITE_Y), (sy0 + 1) & 0xff, "the SECOND inc must bump (0x694f), the sprite Y");
  assert.equal(p.machine.regs.hl, 0x694f, "HL must end at 0x694f (sub_3fc0's clobber)");
  console.log(
    `  CONTRACT: EQUAL -- ${p.cycles} t, MARIO_Y 0x${y0.toString(16)}->0x${((y0 + 1) & 0xff).toString(16)}, ` +
      `(0x694d)=3, sprite-Y 0x${sy0.toString(16)}->0x${((sy0 + 1) & 0xff).toString(16)}, HL=0x694f`,
  );
});

test("BRANCH-TEETH (cycles): a dropped m.step charge yields a wrong total and is CAUGHT", () => {
  const entry = captureEntry();
  const good = runFrom(entry, optimized_2284);
  const dropped = runFrom(entry, cyclebroken_2284); // 5 t short
  assert.equal(good.cycles, PINNED_CYCLES, `the correct total is ${PINNED_CYCLES} t`);
  assert.notEqual(dropped.cycles, good.cycles, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH: correct ${good.cycles} t vs dropped-charge ${dropped.cycles} t -- caught`);
});

// -- TEETH (unit, value) -----------------------------------------------------

test("TEETH (unit): a wrong MARIO_Y store is CAUGHT and names 0x6205", () => {
  const entry = captureEntry();
  const a = entry.clone();
  const b = entry.clone();
  translated_2284(a);
  broken_2284(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));

  assert.ok(ram != null, "harness FAILED to catch a wrong store -- it is worthless");
  assert.equal(
    ram.addr, MARIO_Y,
    `expected first diff at the broken address 0x${MARIO_Y.toString(16)}, got 0x${ram.addr.toString(16)}`,
  );
  console.log(`  TEETH/unit: caught at 0x${ram.addr.toString(16)} (translated ${ram.a} vs broken ${ram.b})`);
});
