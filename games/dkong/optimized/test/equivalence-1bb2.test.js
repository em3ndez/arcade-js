// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_1bb2 -- the AIRBORNE (0x6216==1) movement-update HEAD
 * (ld ix,0x6200 ; snapshot X/Y into the record ; call 0x239c ; call 0x241f ; dec d ;
 * jp nz,0x1bf2 ; else ld (ix+0x10),0x00 ; ld (ix+0x11),0x80 ; set 7,(ix+0x07) ; -> loc_1bd8).
 * COLLAPSED: the 5-instruction head folds to one m.step (78 t -> 0x1BC2); the two CALLs
 * stay verbatim; each fork arm folds `dec d` into its total (gate-ON 14 t -> 0x1BF2,
 * gate-OFF 70 t -> 0x1BD8). See optimized/loc_1bb2.js for the fold, the flag analysis, the
 * X-ORIGINATION contract (loc_1bb2 BUILDS X over its own ix=0x6200 and threads it out --
 * it is entry_1bf2's caller, not a passthrough recipient), and why the gate-OFF arm is
 * 70 t (fall-through into loc_1bd8, no trailing jp) with the not-taken jp nz charged 5 t.
 *
 * REACHABILITY + ATOMICITY (measured, not assumed). loc_1bb2 is dispatched from the
 * per-frame movement cascade under loc_197a (loc_197a -> entry_1ac3 -> loc_1bb2). Probed
 * over attract: 360 entries in 5000 frames (83 by frame 1200). It is ATOMIC: every entry
 * occurs with io.nmiMask CLEARED -- inside the vblank NMI (360/360 in-NMI, 0 out) where
 * the handler cleared the mask so it cannot re-enter. So no NMI lands inside THIS routine:
 * the head-block fold pushes no mistimed PC, and it passes the BYTE-EXACT whole-machine
 * gate directly (confirmed below). STRICT is the right license -- NOT the convergent gate
 * (which is for interruptible collapses whose mistimed-NMI tear false-fails the strict gate).
 *
 * THE X-ORIGINATION is exercised explicitly. loc_1bb2 takes NO X param -- it OVERWRITES
 * whatever ix it is entered with (measured garbage: 0x7525 / 0x66a0) and builds X over
 * 0x6200. The crafted tests seed a GARBAGE incoming ix and prove (a) ix is forced to 0x6200,
 * (b) the head/mirror writes land at 0x620B/0x620C and 0x6210/0x6211/0x6207 (NOT the incoming
 * ix's record), and (c) the X threaded to each tail callee computes 0x6200-relative addresses.
 * A "kept the stale ix" bug would diverge.
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth;
 * UNIT EQUAL on the natural first entry (gate-ON arm, real callees) and its behavioural
 * teeth; FULL-BRANCH coverage of both arms from crafted entries (EQUAL over RAM+regs+pc+SP
 * AND each arm's exact cycle TOTAL -- the gate-OFF arm is not reached naturally in attract,
 * so it is synthesised); the X-origination proof; and a dropped-charge cycle twin CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1bb2 as translated_1bb2 } from "../../translated/state0.js";
import { loc_1bb2 as optimized_1bb2 } from "../loc_1bb2.js";
import { MARIO_X, MARIO_Y } from "../ram.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1bb2;
const FRAMES_WHOLE = 1200; // ~83 invocations (all gate-ON) by frame 1200
const FRAMES_UNIT = 1200;  // the unit host must run past the first dispatch (~frame 587)

const RET_ADDR = 0x4d17;    // sentinel caller return address (the tail callee's ret target)
const REC_BASE = 0x6200;    // the airborne record base loc_1bb2 FORCES regardless of incoming ix
const GARBAGE_IX = 0x6800;  // a wrong-but-in-RAM incoming ix; a stale-ix bug writes 0x680B not 0x620B
const SEED_X = 0x5a;        // MARIO_X marker -> expected at the prev-X snapshot (0x620B)
const SEED_Y = 0xa5;        // MARIO_Y marker -> expected at the prev-Y snapshot (0x620C)
const SEED_SPRITE = 0x45;   // (ix+0x07) with bit 7 CLEAR so `set 7,(ix+0x07)` -> 0xC5 is observable

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ---------------

test("STRICT (whole-machine): collapsed loc_1bb2 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1bb2]]));
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

test("STRICT-TEETH (cycles): a shorted head charge forks the trajectory and is CAUGHT", () => {
  // The collapse's load-bearing invariant is total-cycle preservation. Shorting the head
  // (executed on EVERY entry) shifts the frame's cycle budget -> the spin count 0x6019
  // (PRNG entropy) and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.ix = 0x6200;
    const X = (d) => (regs.ix + d) & 0xffff;
    regs.a = mem.read8(MARIO_X); mem.write8(X(0x0b), regs.a);
    regs.a = mem.read8(MARIO_Y); mem.write8(X(0x0c), regs.a);
    m.step(0x1bc2, 73); // BUG: 78 -> 73
    m.push16(0x1bc5); m.step(0x239c, 17); m.call(0x239c);
    m.push16(0x1bc8); m.step(0x241f, 17); m.call(0x241f);
    regs.d = regs.dec8(regs.d);
    if (regs.fNZ) { m.step(0x1bf2, 14); return m.call(0x1bf2, X); }
    mem.write8(X(0x10), 0x00); mem.write8(X(0x11), 0x80);
    mem.write8(X(0x07), regs.set(7, mem.read8(X(0x07))));
    m.step(0x1bd8, 70); return m.call(0x1bd8, X);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry: the gate-ON arm, REAL callees) -----------------

/** Capture the pristine machine the instant loc_1bb2 is first entered (via m.call, deep in
 *  the NMI movement cascade). The snapshot override is wired at CONSTRUCTION so it fires
 *  however the routine is reached, then delegates to the oracle. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1bb2(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Run oracle and `fn` on independent clones of `entry`; report the diff. loc_1bb2 takes
 *  only (m) -- it builds its own X, so nothing is threaded in. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  translated_1bb2(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic loc_1bb2 matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_1bb2);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F, D) + pc identical (natural gate-ON entry, real callees)");
});

test("TEETH (unit behavioural): routing the gate-ON arm to the WRONG callee is CAUGHT", () => {
  // The natural entry takes the gate-ON arm (D != 1 -> entry_1bf2). A twin that instead
  // hands off to loc_1bd8 (the gate-OFF callee) -- a "wrong branch destination" bug --
  // skips entry_1bf2's `dec e` + the 0x1C05 subtree and runs a different routine tree,
  // leaving different RAM/registers (E in particular). (A wrong-X bug is separately caught
  // by the gate-OFF + X-origination branch tests.)
  const broken_wrongTarget = (m) => {
    const { regs, mem } = m;
    regs.ix = 0x6200;
    const X = (d) => (regs.ix + d) & 0xffff;
    regs.a = mem.read8(MARIO_X); mem.write8(X(0x0b), regs.a);
    regs.a = mem.read8(MARIO_Y); mem.write8(X(0x0c), regs.a);
    m.step(0x1bc2, 78);
    m.push16(0x1bc5); m.step(0x239c, 17); m.call(0x239c);
    m.push16(0x1bc8); m.step(0x241f, 17); m.call(0x241f);
    regs.d = regs.dec8(regs.d);
    if (regs.fNZ) { m.step(0x1bf2, 14); return m.call(0x1bd8, X); } // BUG: gate-ON -> 0x1bd8
    m.step(0x1bd8, 70); return m.call(0x1bd8, X);
  };
  const r = runBoth(NATURAL_ENTRY, broken_wrongTarget);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a wrong tail destination -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${r.ram ? "RAM diff at 0x" + (r.ram.addr ?? 0).toString(16) : r.regs ? "reg diff at " + r.regs.reg : "pc/sp diff"}`);
});

// -- FULL-BRANCH COVERAGE (crafted entries: both arms) -------------------------

/**
 * Fresh machine seeded with loc_1bb2's contract: D (the FIRST gate value, whose `dec d`
 * selects the arm), a GARBAGE incoming ix (loc_1bb2 must overwrite it with 0x6200), marker
 * bytes at MARIO_X/MARIO_Y (proving the head snapshot) and at (ix+0x07) (bit 7 clear so
 * `set 7` is observable), and a valid SP with a sentinel return address. The head calls
 * 0x239c/0x241f are stubbed zero-cost so D passes through unchanged AND the cycle delta is
 * loc_1bb2's OWN charge alone. Both tail callees (entry_1bf2/loc_1bd8) are stubbed zero-cost
 * and CAPTURE the X threaded to them, so the X-origination can be asserted.
 */
function seed(d, incomingIx = GARBAGE_IX) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // loc_1bb2's caller frame
  m.regs.d = d;
  m.regs.ix = incomingIx; // GARBAGE: loc_1bb2 forces 0x6200
  m.mem.write8(MARIO_X, SEED_X);
  m.mem.write8(MARIO_Y, SEED_Y);
  m.mem.write8(0x6207, SEED_SPRITE); // (0x6200 + 0x07)
  m.routines.set(0x239c, () => {}); // isolate loc_1bb2's own cycles; leave D untouched
  m.routines.set(0x241f, () => {});
  const cap = { X: null, target: null };
  m.routines.set(0x1bf2, (mm, X) => { cap.X = X; cap.target = 0x1bf2; });
  m.routines.set(0x1bd8, (mm, X) => { cap.X = X; cap.target = 0x1bd8; });
  return { m, cap };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle total
 *  against the oracle and against the structural constant `expectCycles`. */
function assertArm(label, d, expectCycles, incomingIx = GARBAGE_IX) {
  const A = seed(d, incomingIx);
  const B = seed(d, incomingIx);
  const ca0 = A.m.cycles, cb0 = B.m.cycles;
  translated_1bb2(A.m);
  optimized_1bb2(B.m);
  const dA = A.m.cycles - ca0, dB = B.m.cycles - cb0;

  const ram = firstStateDiff(A.m.dumpState(), B.m.dumpState(), (off) => A.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(A.m.regs, B.m.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(A.m.pc, B.m.pc, "pc must match");
  assert.equal(A.m.regs.sp, B.m.regs.sp, "SP must match");
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs collapsed ${dB} t)`);
  assert.equal(dA, expectCycles, `${label}: oracle total should be ${expectCycles} t (got ${dA})`);
  console.log(`  BRANCH/${label}: EQUAL -- pc=0x${B.m.pc.toString(16)}, ${dB} t == oracle ${dA} t`);
}

test("BRANCH (unit): gate-ON arm -- D!=1, jp nz taken -> entry_1bf2 (head 78 + 2 calls 34 + 4+10 = 126 t)", () => {
  // d=2 -> dec to 1 (NZ). This is the naturally-reached arm; no record MIRROR write.
  assertArm("gate-ON", 2, 126);
  const { m, cap } = seed(2);
  optimized_1bb2(m);
  assert.equal(m.pc, 0x1bf2, "gate-ON arm transfers to entry_1bf2 (0x1BF2)");
  assert.equal(cap.target, 0x1bf2, "gate-ON arm dispatched entry_1bf2, not loc_1bd8");
  assert.equal(m.regs.d, 1, "gate-ON arm decremented D to 1");
  assert.equal(m.regs.ix, REC_BASE, "loc_1bb2 forces ix=0x6200 (incoming garbage overwritten)");
  assert.equal(m.mem.read8(0x620b), SEED_X, "head snapshot: (0x620B) = MARIO_X");
  assert.equal(m.mem.read8(0x620c), SEED_Y, "head snapshot: (0x620C) = MARIO_Y");
  assert.equal(m.mem.read8(0x6207), SEED_SPRITE, "gate-ON arm writes NO record MIRROR ((0x6207) untouched)");
  assert.equal(cap.X(0x10), 0x6210, "X threaded to entry_1bf2 addresses the 0x6200 record");
});

test("BRANCH (unit): gate-OFF arm -- D==1 -> 3 record writes + loc_1bd8 (head 78 + 34 + 4+5+19+19+23 = 182 t)", () => {
  // SYNTHESISED: the D==1 arm is never reached naturally in attract. d=1 -> dec to 0 (Z).
  assertArm("gate-OFF", 1, 182);
  const { m, cap } = seed(1);
  optimized_1bb2(m);
  assert.equal(m.pc, 0x1bd8, "gate-OFF arm falls into the landing/gravity routine 0x1BD8");
  assert.equal(cap.target, 0x1bd8, "gate-OFF arm dispatched loc_1bd8, not entry_1bf2");
  assert.equal(m.regs.d, 0, "gate-OFF arm decremented D to 0");
  assert.equal(m.mem.read8(0x6210), 0x00, "gate-OFF sets (ix+0x10) = 0x00");
  assert.equal(m.mem.read8(0x6211), 0x80, "gate-OFF sets (ix+0x11) = 0x80");
  assert.equal(m.mem.read8(0x6207), 0xc5, "gate-OFF set 7 of (ix+0x07): 0x45 -> 0xC5");
  assert.equal(m.mem.read8(0x620b), SEED_X, "head snapshot still ran: (0x620B) = MARIO_X");
  assert.equal(m.mem.read8(0x620c), SEED_Y, "head snapshot still ran: (0x620C) = MARIO_Y");
});

test("BRANCH (unit): loc_1bb2 IGNORES incoming ix and builds X over 0x6200 -- X-origination proof", () => {
  // loc_1bb2 is the X ORIGINATOR: whatever garbage ix it enters with, it must force 0x6200,
  // write to the 0x6200 record, and thread an X that addresses 0x6200. A "kept the stale ix"
  // bug would write the incoming-ix record instead and diverge. Both arms exercised.
  for (const [d, target, mirrorAddr] of [[2, 0x1bf2, null], [1, 0x1bd8, 0x6210]]) {
    const { m, cap } = seed(d, GARBAGE_IX);
    optimized_1bb2(m);
    assert.equal(m.regs.ix, REC_BASE, `ix forced to 0x6200 regardless of incoming 0x${GARBAGE_IX.toString(16)}`);
    assert.equal(cap.target, target, "correct arm dispatched");
    assert.equal(cap.X(0x00), 0x6200, "threaded X is 0x6200-based");
    assert.equal(cap.X(0x0b), 0x620b, "threaded X(0x0b) = 0x620B");
    assert.equal(m.mem.read8(0x620b), SEED_X, "prev-X snapshot landed at 0x620B (not the incoming-ix record)");
    assert.equal(m.mem.read8(GARBAGE_IX + 0x0b), 0x00, "the incoming-ix record was NOT written");
    if (mirrorAddr !== null) assert.equal(m.mem.read8(mirrorAddr), 0x00, "gate-OFF mirror write landed at 0x6210");
  }
  console.log("  BRANCH/X-origination: ix forced to 0x6200; writes + threaded X all 0x6200-based (incoming ix ignored)");
});

test("BRANCH-TEETH (cycles): a dropped charge on the gate-OFF arm yields a wrong total and is CAUGHT", () => {
  // Gate-OFF arm charged 65 instead of 70 -> total no longer matches the oracle.
  const dropped = (m) => {
    const { regs, mem } = m;
    regs.ix = 0x6200;
    const X = (d) => (regs.ix + d) & 0xffff;
    regs.a = mem.read8(MARIO_X); mem.write8(X(0x0b), regs.a);
    regs.a = mem.read8(MARIO_Y); mem.write8(X(0x0c), regs.a);
    m.step(0x1bc2, 78);
    m.push16(0x1bc5); m.step(0x239c, 17); m.call(0x239c);
    m.push16(0x1bc8); m.step(0x241f, 17); m.call(0x241f);
    regs.d = regs.dec8(regs.d);
    if (regs.fNZ) { m.step(0x1bf2, 14); return m.call(0x1bf2, X); }
    mem.write8(X(0x10), 0x00); mem.write8(X(0x11), 0x80);
    mem.write8(X(0x07), regs.set(7, mem.read8(X(0x07))));
    m.step(0x1bd8, 65); return m.call(0x1bd8, X); // DROPPED: 70 -> 65
  };
  const a = seed(1);
  const b = seed(1);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_1bb2(a.m);
  dropped(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
