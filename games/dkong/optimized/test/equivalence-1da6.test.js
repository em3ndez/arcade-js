// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for entry_1da6 -- the PLAYER sprite -> draw-buffer copy
 * (ld hl,0x694c ; four `ld a,(field) [inc l] ld (hl),a` moves ; ret). It is BRANCH-FREE,
 * so there is a single path; its cycle body is FULLY COLLAPSED to one m.step (102 t at
 * 0x1DBC) + m.ret (10 t) = 112 t. See optimized/entry_1da6.js for the fold, the flag
 * analysis, and why all of A/HL/F are reproduced (observable at the unit boundary).
 *
 * REACHABILITY / ATOMICITY (MEASURED here, not assumed -- the oracle's "not wired" note is
 * STALE, and so is any "loc_197a is interruptible" claim). loc_197a is dispatched from the
 * NMI gameplay path and its cascade reaches this convergence tail via its ~11 `jp 0x1da6`
 * callers. Probed over an all-oracle run: 427 entries in 1200 attract frames (first ~f587,
 * once the attract demo starts PLAYING 25m) and 43 in 1600 driven-gameplay frames -- so a
 * whole-machine run exercises it and the gate is NON-vacuous.
 *
 * ATOMIC, so the STRICT byte-exact whole-machine gate is the right license (not the
 * convergent gate, which is for INTERRUPTIBLE collapses whose mistimed-NMI raster tear /
 * dead-stack PC false-fail the strict gate). Probed: EVERY entry occurs INSIDE the NMI
 * handler with the NMI mask CLEARED (in-NMI 427/427 attract, 43/43 gameplay; mask-set 0/0),
 * and entry_1da6 is a pure LEAF (no m.call) so the mask stays clear through its whole body
 * and the NMI cannot re-enter -- the NMI's pushed PC never lands in [0x1DA6,0x1DBC] (0
 * landings). A correct atomic collapse is therefore byte-exact, confirmed below by the
 * strict gate passing over a 100+-invocation window.
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth; UNIT
 * EQUAL on the natural first entry and its behavioural teeth; FULL-PATH crafted coverage
 * (EQUAL over RAM+regs+pc+SP, distinct field values, carry-in preserved BOTH ways, AND the
 * exact 112 t total); and a dropped-charge cycle twin CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { entry_1da6 as translated_1da6 } from "../../translated/state0.js";
import { entry_1da6 as optimized_1da6 } from "../entry_1da6.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { MARIO_X, MARIO_Y, MARIO_SPRITE_CODE, MARIO_SPRITE_ATTR, MARIO_SPRITE_RECORD } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1da6;
const FRAMES_WHOLE = 720; // past the ~f587 first dispatch, 100+ invocations, teeth diverge just after
const FRAMES_UNIT = 650; // the unit host must run past the first dispatch (~f587) to capture it

const RET_ADDR = 0x4d17; // sentinel return address for the crafted `ret`
const F_C = 0x01; // Z80 carry bit, for the carry-in-preserved coverage

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ---------------

test("STRICT (whole-machine): collapsed entry_1da6 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1da6]]));
  const fired = r.invocations.get(TARGET);
  assert.ok(fired >= 1, `override at 0x${TARGET.toString(16)} never dispatched (invocations=${fired})`);
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `NOT byte-exact: frame ${r.frame} addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
  console.log(`  STRICT: byte-exact over ${r.framesCompared} frames, fired ${fired}x (atomic collapse)`);
});

test("STRICT-TEETH (cycles): a wrong body total forks the trajectory and is CAUGHT", () => {
  // The collapse's load-bearing invariant is total-cycle preservation. Charging the body
  // 101 t instead of 102 shifts the frame's cycle budget -> the spin count 0x6019 (PRNG
  // entropy) and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.hl = MARIO_SPRITE_RECORD;
    regs.a = mem.read8(MARIO_X); mem.write8(regs.hl, regs.a);
    for (const src of [MARIO_SPRITE_CODE, MARIO_SPRITE_ATTR, MARIO_Y]) {
      regs.a = mem.read8(src); regs.l = regs.inc8(regs.l); mem.write8(regs.hl, regs.a);
    }
    m.step(0x1dbc, 101); // DROPPED: 102 -> 101
    m.ret(10);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry) -----------------------------------------------

/** Capture the pristine machine the instant entry_1da6 is first entered (via m.call, deep
 *  in the NMI cascade). The snapshot override is wired at CONSTRUCTION so it fires however
 *  the routine is reached, then delegates to the oracle so the host run proceeds normally. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1da6(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Run oracle and `fn` on independent clones of `entry`; report the diff + contract. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  translated_1da6(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic entry_1da6 matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_1da6);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F, A, HL, SP) + pc identical (natural entry)");
});

test("TEETH (unit behavioural): dropping the last `inc l` mis-addresses the copy and is CAUGHT", () => {
  // A twin that skips the FINAL inc l: MARIO_Y is written to record +2 (0x694E) instead of
  // +3, record +3 (0x694F) is left stale, and HL ends 0x694E -- all observable.
  const broken = (m) => {
    const { regs, mem } = m;
    regs.hl = MARIO_SPRITE_RECORD;
    regs.a = mem.read8(MARIO_X); mem.write8(regs.hl, regs.a);
    regs.a = mem.read8(MARIO_SPRITE_CODE); regs.l = regs.inc8(regs.l); mem.write8(regs.hl, regs.a);
    regs.a = mem.read8(MARIO_SPRITE_ATTR); regs.l = regs.inc8(regs.l); mem.write8(regs.hl, regs.a);
    regs.a = mem.read8(MARIO_Y); /* BUG: inc l dropped */ mem.write8(regs.hl, regs.a);
    m.step(0x1dbc, 102);
    m.ret(10);
  };
  const r = runBoth(NATURAL_ENTRY, broken);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a mis-addressed copy -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${r.regs ? "reg diff at " + r.regs.reg : (r.ram ? "RAM diff at 0x" + (r.ram.addr).toString(16) : "pc/sp")}`);
});

// -- FULL-PATH COVERAGE (crafted entry: distinct fields, carry-in both ways) ---

/** Fresh machine with a `ret` frame and DISTINCT source field values, so a wrong copy
 *  order or a dropped field is visible in the record. `carryIn` seeds the F carry bit to
 *  prove `inc l` preserves it into the exit F (observable). HL/A are seeded with junk to
 *  prove they are set deterministically (HL := 0x694c is unconditional). */
function seed(carryIn) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // entry_1da6's return frame
  m.mem.write8(MARIO_X, 0x11);
  m.mem.write8(MARIO_SPRITE_CODE, 0x22);
  m.mem.write8(MARIO_SPRITE_ATTR, 0x33);
  m.mem.write8(MARIO_Y, 0x44);
  m.regs.hl = 0xdead;
  m.regs.a = 0x99;
  if (carryIn) m.regs.f |= F_C; else m.regs.f &= ~F_C;
  return m;
}

/** Prove the single path EQUAL (RAM + full register file + pc + SP) AND pin its exact
 *  cycle total against the oracle and against the structural constant 112 t. */
function assertPath(carryIn) {
  const label = `carry-${carryIn ? "set" : "clear"}`;
  const a = seed(carryIn);
  const b = seed(carryIn);
  const ca0 = a.cycles, cb0 = b.cycles;
  translated_1da6(a);
  optimized_1da6(b);
  const dA = a.cycles - ca0, dB = b.cycles - cb0;

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.regs, b.regs);
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg}` : "");
  assert.equal(a.pc, b.pc, `${label}: pc must match`);
  assert.equal(a.regs.sp, b.regs.sp, `${label}: SP must match`);
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs collapsed ${dB} t)`);
  assert.equal(dA, 112, `${label}: oracle total should be 112 t (got ${dA})`);
  console.log(`  PATH/${label}: EQUAL -- pc=0x${b.pc.toString(16)}, HL=0x${b.regs.hl.toString(16)}, ` +
    `A=0x${b.regs.a.toString(16)}, F=0x${b.regs.f.toString(16)}, ${dB} t == oracle ${dA} t`);
}

test("PATH (unit): single branch-free path EQUAL + exact 112 t total (carry-in clear)", () => {
  assertPath(false);
  const m = seed(false);
  optimized_1da6(m);
  assert.equal(m.pc, RET_ADDR, "returns to the sentinel");
  assert.equal(m.regs.sp, 0x6c00, "pops exactly one frame");
  assert.equal(m.regs.hl, (MARIO_SPRITE_RECORD + 3) & 0xffff, "HL ends at record +3 (0x694f)");
  assert.equal(m.regs.a, 0x44, "A ends holding the last field read (MARIO_Y)");
  // Record fields are the four sources in the DELIBERATE order +0 X, +1 code, +2 attr, +3 Y.
  assert.equal(m.mem.read8(MARIO_SPRITE_RECORD + 0), 0x11, "record +0 := X");
  assert.equal(m.mem.read8(MARIO_SPRITE_RECORD + 1), 0x22, "record +1 := code");
  assert.equal(m.mem.read8(MARIO_SPRITE_RECORD + 2), 0x33, "record +2 := attr");
  assert.equal(m.mem.read8(MARIO_SPRITE_RECORD + 3), 0x44, "record +3 := Y");
});

test("PATH (unit): carry-in is PRESERVED through inc l into the exit F (carry-in set)", () => {
  // `inc l` never touches carry, so entry carry must survive to exit F -- observable, and
  // the only way the two carry-in cases differ. assertPath diffs the whole F byte.
  assertPath(true);
  const m = seed(true);
  optimized_1da6(m);
  assert.equal(m.regs.f & F_C, F_C, "carry preserved into exit F");
});

test("PATH-TEETH (cycles): a dropped charge yields a wrong total and is CAUGHT", () => {
  // Body charged 100 instead of 102 -> total no longer matches the oracle.
  const dropped = (m) => {
    const { regs, mem } = m;
    regs.hl = MARIO_SPRITE_RECORD;
    regs.a = mem.read8(MARIO_X); mem.write8(regs.hl, regs.a);
    for (const src of [MARIO_SPRITE_CODE, MARIO_SPRITE_ATTR, MARIO_Y]) {
      regs.a = mem.read8(src); regs.l = regs.inc8(regs.l); mem.write8(regs.hl, regs.a);
    }
    m.step(0x1dbc, 100); // DROPPED: 102 -> 100
    m.ret(10);
  };
  const a = seed(false);
  const b = seed(false);
  const ca0 = a.cycles, cb0 = b.cycles;
  translated_1da6(a);
  dropped(b);
  const dA = a.cycles - ca0, dB = b.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  PATH-TEETH: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
