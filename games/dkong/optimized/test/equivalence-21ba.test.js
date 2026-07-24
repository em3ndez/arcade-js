// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_21ba -- the SHARED OBJECT-SPRITE TAIL (exx ; four
 * `ld a,(ix+d) [inc l] ld (hl),a` moves ; jp 0x1f8d). It is BRANCH-FREE, so there is a
 * single path; its whole run (exx + the four copies + the tail jp) is FULLY COLLAPSED to
 * one m.step (130 t at 0x1F8D), then m.call(0x1f8d) re-enters sub_1f72's slot-scan loop.
 * See optimized/loc_21ba.js for the fold, the flag analysis, the exx contract, and why
 * all of A/HL/F are reproduced (observable at the m.call boundary).
 *
 * REACHABILITY / ATOMICITY (MEASURED here, not assumed -- the oracle's "not yet wired /
 * goes live at the finale" note is STALE; the swap layer wired sub_1f72's cascade). loc_21ba
 * is dispatched deep in the loc_197a NMI update cascade via sub_1f72's per-slot object scan.
 * Probed over an all-oracle run: 121 entries by frame 720 (first at frame 612, once the
 * attract demo starts PLAYING 25m), 1592 by 1200, 3346 by 1600 -- so a whole-machine run
 * exercises it heavily and the gate is strongly NON-vacuous.
 *
 * ATOMIC, so the STRICT byte-exact whole-machine gate is the right license (not the
 * convergent gate, which is for INTERRUPTIBLE collapses whose mistimed-NMI raster tear /
 * dead-stack PC false-fail the strict gate). Probed: EVERY entry occurs INSIDE the NMI
 * handler with the NMI mask CLEARED (in-NMI 3346/3346, mask-set 0/0), and the collapsed
 * region [0x21BA,0x21CE] is a pure straight-line body (the m.call(0x1f8d) is AFTER it), so
 * the mask stays clear through it and the NMI cannot re-enter -- the NMI's pushed PC never
 * lands in [0x21BA,0x21CE] (0 landings over 1600 frames). A correct atomic collapse is
 * therefore byte-exact, confirmed below by the strict gate passing over a 100+-invocation
 * window (same evidence as the sibling entry_1da6 / loc_1f8d).
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth; UNIT
 * EQUAL on the natural first entry and its behavioural teeth (a wrong copy); FULL-PATH
 * crafted coverage (EQUAL over RAM+regs+pc, distinct field values, carry-in preserved BOTH
 * ways, AND the exact 130 t total -- with loc_1f8d stubbed so the tail jp halts and the
 * comparison isolates loc_21ba's own effect); and a dropped-charge cycle twin CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_21ba as translated_21ba } from "../../translated/state0.js";
import { loc_21ba as optimized_21ba } from "../loc_21ba.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x21ba;
const CONT = 0x1f8d; // the tail-jp continuation (sub_1f72's loop advance)
const FRAMES_WHOLE = 720; // past the ~f612 first dispatch, ~121 invocations; teeth diverge just after
const FRAMES_UNIT = 650; // the unit host must run past the first dispatch (~f612) to capture it

const F_C = 0x01; // Z80 carry bit, for the carry-in-preserved coverage

// The four object RECORD-FIELD offsets and the distinct values the crafted test stamps.
const REC_BASE = 0x6700; // an object record base for IX (crafted)
const FIELD_OFF = [0x03, 0x07, 0x08, 0x05];
const FIELD_VAL = [0x11, 0x22, 0x33, 0x44]; // distinct -> a wrong copy order/field is visible
const BUF_BASE = 0x6990; // destination record base in the 0x69xx sprite-shadow buffer

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ---------------

test("STRICT (whole-machine): collapsed loc_21ba is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_21ba]]));
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
  // 129 t instead of 130 shifts the frame's cycle budget -> the spin count 0x6019 (PRNG
  // entropy) and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.exx();
    regs.a = mem.read8((regs.ix + FIELD_OFF[0]) & 0xffff); mem.write8(regs.hl, regs.a);
    for (let i = 1; i < FIELD_OFF.length; i++) {
      regs.a = mem.read8((regs.ix + FIELD_OFF[i]) & 0xffff);
      regs.l = regs.inc8(regs.l);
      mem.write8(regs.hl, regs.a);
    }
    m.step(CONT, 129); // DROPPED: 130 -> 129
    return m.call(CONT);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry) -----------------------------------------------

/** Capture the pristine machine the instant loc_21ba is first entered (via m.call, deep in
 *  the NMI cascade). The snapshot override is wired at CONSTRUCTION so it fires however the
 *  routine is reached, then delegates to the oracle so the host run proceeds normally. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_21ba(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Run oracle and `fn` on independent clones of `entry`; report the diff. Both sides run
 *  the identical downstream (loc_1f8d + the rest of the scan) through the SAME oracle
 *  registry, so any diff localizes to loc_21ba's own effect on the shared entry state. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  translated_21ba(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic loc_21ba matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_21ba);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F, A, HL, SP) + pc identical (natural entry)");
});

test("TEETH (unit behavioural): copying (ix+0x07) twice mis-fills the record and is CAUGHT", () => {
  // A twin that reads (ix+0x07) again where field +2 should read (ix+0x08): record +2 gets
  // the code byte instead of the attr byte. The wrong buffer byte propagates through the
  // downstream scan (loc_1f8d + the rest), so it surfaces in RAM.
  const broken = (m) => {
    const { regs, mem } = m;
    regs.exx();
    regs.a = mem.read8((regs.ix + 0x03) & 0xffff); mem.write8(regs.hl, regs.a);
    regs.a = mem.read8((regs.ix + 0x07) & 0xffff); regs.l = regs.inc8(regs.l); mem.write8(regs.hl, regs.a);
    regs.a = mem.read8((regs.ix + 0x07) & 0xffff); regs.l = regs.inc8(regs.l); mem.write8(regs.hl, regs.a); // BUG: 0x07 not 0x08
    regs.a = mem.read8((regs.ix + 0x05) & 0xffff); regs.l = regs.inc8(regs.l); mem.write8(regs.hl, regs.a);
    m.step(CONT, 130);
    return m.call(CONT);
  };
  const r = runBoth(NATURAL_ENTRY, broken);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch a mis-filled record -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${r.regs ? "reg diff at " + r.regs.reg : (r.ram ? "RAM diff at 0x" + (r.ram.addr).toString(16) : "pc/sp")}`);
});

// -- FULL-PATH COVERAGE (crafted entry: distinct fields, carry-in both ways) ---
//
// loc_21ba tail-jumps into sub_1f72's loop (m.call(0x1f8d)), which would recurse the whole
// object scan. To ISOLATE loc_21ba's own effect + exact cycle total, the crafted machine
// stubs 0x1f8d to a no-op halt (charges nothing, returns) -- applied identically to the
// oracle and optimized sides, so both stop the instant the tail jp is taken.

const HALT_1F8D = () => new Map([[CONT, () => { /* halt: stop the loop re-entry */ }]]);

/** Fresh machine (0x1f8d stubbed) with an object record of DISTINCT field values at IX, and
 *  the destination buffer base seeded into the SHADOW HL so the routine's leading `exx`
 *  brings it into the main set (proving exx is honoured, not bypassed). `carryIn` seeds the
 *  F carry to prove `inc l` preserves it into the exit F. Main HL/A are junk to prove they
 *  are set deterministically by exx + the copy. */
function seed(carryIn) {
  const m = new Machine(ROM, { overrides: HALT_1F8D() });
  m.regs.sp = 0x6c00;
  m.regs.ix = REC_BASE;
  for (let i = 0; i < FIELD_OFF.length; i++) m.mem.write8((REC_BASE + FIELD_OFF[i]) & 0xffff, FIELD_VAL[i]);
  m.regs.hl = 0xdead;          // main HL junk -- exx must replace it
  m.regs.h_ = (BUF_BASE >> 8) & 0xff; // shadow HL := the destination base ...
  m.regs.l_ = BUF_BASE & 0xff;        // ... which exx brings into the main set
  m.regs.a = 0x99;             // A junk -- overwritten by the four reads
  if (carryIn) m.regs.f |= F_C; else m.regs.f &= ~F_C;
  return m;
}

/** Prove the single path EQUAL (RAM + full register file + pc + SP) AND pin its exact
 *  cycle total against the oracle and against the structural constant 130 t. */
function assertPath(carryIn) {
  const label = `carry-${carryIn ? "set" : "clear"}`;
  const a = seed(carryIn);
  const b = seed(carryIn);
  const ca0 = a.cycles, cb0 = b.cycles;
  translated_21ba(a);
  optimized_21ba(b);
  const dA = a.cycles - ca0, dB = b.cycles - cb0;

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.regs, b.regs);
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg}` : "");
  assert.equal(a.pc, b.pc, `${label}: pc must match`);
  assert.equal(a.regs.sp, b.regs.sp, `${label}: SP must match`);
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs collapsed ${dB} t)`);
  assert.equal(dA, 130, `${label}: oracle total should be 130 t (got ${dA})`);
  console.log(`  PATH/${label}: EQUAL -- pc=0x${b.pc.toString(16)}, HL=0x${b.regs.hl.toString(16)}, ` +
    `A=0x${b.regs.a.toString(16)}, F=0x${b.regs.f.toString(16)}, ${dB} t == oracle ${dA} t`);
}

test("PATH (unit): single branch-free path EQUAL + exact 130 t total (carry-in clear)", () => {
  assertPath(false);
  const m = seed(false);
  optimized_21ba(m);
  assert.equal(m.pc, CONT, "tail-jumps to 0x1f8d");
  assert.equal(m.regs.hl, (BUF_BASE + 3) & 0xffff, "HL ends at record +3");
  assert.equal(m.regs.a, FIELD_VAL[3], "A ends holding the last field read (ix+0x05)");
  // Record fields are the four sources in the DELIBERATE order +0 (ix+3), +1 (ix+7),
  // +2 (ix+8), +3 (ix+5) -- copied into the destination the shadow HL supplied via exx.
  assert.equal(m.mem.read8(BUF_BASE + 0), FIELD_VAL[0], "record +0 := (ix+0x03)");
  assert.equal(m.mem.read8(BUF_BASE + 1), FIELD_VAL[1], "record +1 := (ix+0x07)");
  assert.equal(m.mem.read8(BUF_BASE + 2), FIELD_VAL[2], "record +2 := (ix+0x08)");
  assert.equal(m.mem.read8(BUF_BASE + 3), FIELD_VAL[3], "record +3 := (ix+0x05)");
});

test("PATH (unit): carry-in is PRESERVED through inc l into the exit F (carry-in set)", () => {
  // `inc l` never touches carry, so entry carry must survive to exit F -- observable, and
  // the only way the two carry-in cases differ. assertPath diffs the whole F byte.
  assertPath(true);
  const m = seed(true);
  optimized_21ba(m);
  assert.equal(m.regs.f & F_C, F_C, "carry preserved into exit F");
});

test("PATH-TEETH (cycles): a dropped charge yields a wrong total and is CAUGHT", () => {
  // Body charged 128 instead of 130 -> total no longer matches the oracle.
  const dropped = (m) => {
    const { regs, mem } = m;
    regs.exx();
    regs.a = mem.read8((regs.ix + FIELD_OFF[0]) & 0xffff); mem.write8(regs.hl, regs.a);
    for (let i = 1; i < FIELD_OFF.length; i++) {
      regs.a = mem.read8((regs.ix + FIELD_OFF[i]) & 0xffff);
      regs.l = regs.inc8(regs.l);
      mem.write8(regs.hl, regs.a);
    }
    m.step(CONT, 128); // DROPPED: 130 -> 128
    return m.call(CONT);
  };
  const a = seed(false);
  const b = seed(false);
  const ca0 = a.cycles, cb0 = b.cycles;
  translated_21ba(a);
  dropped(b);
  const dA = a.cycles - ca0, dB = b.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  PATH-TEETH: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
