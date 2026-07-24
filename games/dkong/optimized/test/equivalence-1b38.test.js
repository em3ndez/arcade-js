// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_1b38 -- the on-ladder input DISPATCH (ROM 0x1B38-0x1B44,
 * falling into 0x1B45). See optimized/loc_1b38.js for the full behaviour block. Three
 * arms:
 *   - ARM A -- Down held (0x6010 bit 3): tail-jump to loc_1cf2 (jump-phase handler).
 *   - ARM B -- Down not held & 0x6215 == 0 (not on a ladder): `ret z`.
 *   - ARM C -- Down not held & 0x6215 != 0 (on a ladder): fall into loc_1b45 (climb-up).
 *
 * GATE = STRICT whole-machine, MEASURED. loc_1b38 is ATTRACT-REACHABLE (190 dispatches
 * over 1600 attract frames; first ~f845, once the demo plays 25m) and ATOMIC: every one
 * of the 190 dispatches runs mask-cleared inside the vblank NMI (io.nmiMask==0 at
 * 190/190) and no NMI pushed-PC ever lands in [0x1b38,0x1b46) (0/1594). Its collapse
 * preserves each arm's cycle TOTAL exactly and the routine performs NO writes, so it is
 * byte-exact: the STRICT gate passes directly (no convergent gate needed). That gate is
 * timing-sensitive -- a wrong total forks the spin-count PRNG (0x6019) and a later NMI's
 * pushed PC -- so it pins the naturally-reached arms' totals (B=135x, C=55x) for free;
 * ARM A (Down) is not reached in attract and is proven by a crafted entry with explicit
 * cycle teeth.
 *
 * Jobs:
 *   1. STRICT (whole-machine) -- byte-exact EQUAL vs the oracle over 1600 attract frames,
 *      with the invocation counter proving the override actually fired (190x).
 *   2. STRICT-TEETH (cycles) -- a twin that mischarges ARM B's ret (59->58 t) forks the
 *      trajectory (spin-count PRNG / NMI pushed-PC) and is CAUGHT by the byte-exact gate.
 *   3. EQUAL (unit, natural entry) -- optimized loc_1b38 matches the oracle in RAM + full
 *      register file + pc on the real first dispatch (an ARM-C, Mario-climbing state).
 *   4. FULL-BRANCH COVERAGE -- all three arms, forced by identical-both-sides pokes of
 *      0x6010/0x6215 (doc 06 reach pattern 3), EQUAL over RAM + regs + pc + SP AND
 *      oracle==optimized cycle total (callees run live, so the callee effects are covered):
 *        - ARM A: Down set          -> loc_1cf2 runs (jump-phase).
 *        - ARM B: Down clr, 0x6215=0 -> ret.
 *        - ARM C: Down clr, 0x6215!=0 -> loc_1b45 runs (climb-up).
 *   5. CYCLES (per-arm, absolute) -- with the callees stubbed to no-ops on both sides,
 *      loc_1b38's OWN charge is EXACTLY: ARM A 31 t (13+8+10, ends 0x1cf2), ARM B 59 t
 *      (13+8+10+13+4+11), ARM C 53 t (13+8+10+13+4+5, ends 0x1b45). Pins each arm's
 *      collapsed total absolutely and state-independently -- including ARM A, which the
 *      whole-machine run never reaches.
 *   6. CYCLE-TEETH (unit) -- a twin dropping ARM B's ret charge yields a wrong total, CAUGHT.
 *   7. TEETH (branch) -- a twin testing bit 2 instead of bit 3 takes the WRONG arm on a
 *      Down-held input (ARM C instead of ARM A), CAUGHT as a RAM/pc divergence.
 *   8. TEETH (register file) -- a twin corrupting the exit A on the ret arm is CAUGHT as a
 *      register diff (the unit gate compares the whole file incl. F).
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1b38 as translated_1b38 } from "../../translated/state0.js";
import { loc_1b38 as optimized_1b38 } from "../loc_1b38.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1b38;
const P1_INPUT = 0x6010; // input port (this frame's cooked control word)
const ON_LADDER = 0x6215; // Mario on-ladder / climb flag (nonzero == on a ladder)
const DOWN = 0x08; // 0x6010 bit 3 = Down held
const FRAMES_WHOLE = 1600; // 190 invocations, past the ~f845 first dispatch
const FRAMES_UNIT = 900; // the unit host must run past the ~f845 first dispatch to capture it

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC, collapse preserves totals) --

test("STRICT (whole-machine): loc_1b38 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1b38]]));
  const fired = r.invocations.get(TARGET);
  assert.ok(fired >= 1, `override at 0x${TARGET.toString(16)} never dispatched (invocations=${fired})`);
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `NOT byte-exact: frame ${r.frame} addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
  console.log(`  STRICT: byte-exact over ${r.framesCompared} frames, fired ${fired}x (atomic, collapse total-preserving)`);
});

test("STRICT-TEETH (cycles): a wrong ARM-B ret charge forks the trajectory and is CAUGHT", () => {
  // The load-bearing invariant is per-arm total-cycle preservation. Charging ARM B's ret
  // 58 t instead of 11+... = 59 t shifts the frame's cycle budget -> the spin count 0x6019
  // (PRNG entropy) and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(P1_INPUT); regs.bit(3, regs.a);
    if (regs.fNZ) { m.step(0x1cf2, 31); return m.call(0x1cf2); }
    regs.a = mem.read8(ON_LADDER); regs.and(regs.a);
    if (regs.fZ) { m.ret(58); return; } // DROPPED: the correct ARM-B total is 59 t
    m.step(0x1b45, 53); return m.call(0x1b45);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry) -----------------------------------------------

/** Capture the pristine machine the instant loc_1b38 is first entered (via m.call, deep
 *  in the entry_1ac3 movement cascade). The snapshot override is wired at CONSTRUCTION so
 *  it fires however the routine is reached, then delegates to the oracle so the host
 *  proceeds normally. The captured entry has a LIVE stack (a poppable return address), so
 *  ARM B's `ret` and the tail callees' `ret` land on a valid address. (entry_30ed /
 *  loc_1b45 tests do the same.) The natural first entry is an ARM-C state: Mario on a
 *  ladder (0x6215=1) with Up held (0x6010=0x04), i.e. climbing. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1b38(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const ENTRY = ROM_PRESENT ? captureEntry() : null;

const NOOP = () => {}; // stub for a tail callee, to isolate loc_1b38's own cycle charge

/** Clone ENTRY, apply identical-both-sides pokes, optionally stub the tail callees
 *  (0x1cf2/0x1b45) to no-ops so ONLY loc_1b38's prologue is measured, run `fn`, and
 *  report the routine's full contract relative to the crafted entry. */
function runBranch(pokes, fn, { stubCallees = false } = {}) {
  const c = ENTRY.clone();
  for (const [a, v] of pokes) c.mem.write8(a, v);
  if (stubCallees) { c.routines.set(0x1cf2, NOOP); c.routines.set(0x1b45, NOOP); }
  const c0 = c.cycles;
  const ret = fn(c);
  return { ret, cycles: c.cycles - c0, sp: c.regs.sp, pc: c.pc, machine: c };
}

test("EQUAL (unit): idiomatic loc_1b38 matches translated in RAM + full register file + pc", () => {
  // Natural entry (no poke) -- the real ARM-C climbing state; loc_1b45 runs live.
  const o = runBranch([], translated_1b38);
  const p = runBranch([], optimized_1b38);
  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  assert.equal(firstRegDiff(o.machine.regs, p.machine.regs), null, "registers must match");
  assert.equal(o.pc, p.pc, "pc must match");
  assert.equal(o.sp, p.sp, "SP must match");
  console.log("  EQUAL/unit: RAM + full register file (incl. A, F, SP) + pc identical (natural ARM-C entry)");
});

// -- FULL-BRANCH COVERAGE (crafted identical-both-sides pokes: all 3 arms) ------

/** Prove one arm EQUAL (RAM + full register file + pc + SP) with the callees running
 *  LIVE (so their effects are covered), AND pin its cycle total oracle==optimized. */
function assertArmEqual(label, pokes) {
  const o = runBranch(pokes, translated_1b38);
  const p = runBranch(pokes, optimized_1b38);
  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(o.machine.regs, p.machine.regs);
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg}` : "");
  assert.equal(o.pc, p.pc, `${label}: pc must match`);
  assert.equal(o.sp, p.sp, `${label}: SP must match`);
  assert.equal(o.cycles, p.cycles, `${label}: cycle total mismatch (oracle ${o.cycles} t vs optimized ${p.cycles} t)`);
  console.log(`  BRANCH/${label}: EQUAL -- ${p.cycles} t, pc=0x${p.pc.toString(16)}, ` +
    `A=0x${p.machine.regs.a.toString(16)}, F=0x${p.machine.regs.f.toString(16)}`);
}

test("BRANCH: ARM A -- Down held (bit 3 set) -> tail-jump to loc_1cf2 (jump-phase)", () => {
  assertArmEqual("armA-down", [[P1_INPUT, DOWN], [ON_LADDER, 0x01]]);
});

test("BRANCH: ARM B -- Down clr & 0x6215==0 (not on a ladder) -> ret", () => {
  assertArmEqual("armB-ret", [[P1_INPUT, 0x00], [ON_LADDER, 0x00]]);
});

test("BRANCH: ARM C -- Down clr & 0x6215!=0 (on a ladder) -> fall into loc_1b45 (climb)", () => {
  assertArmEqual("armC-ladder", [[P1_INPUT, 0x04], [ON_LADDER, 0x01]]);
});

test("BRANCH: ARM A with all bits set (0xff) -- still jump-phase (only bit 3 gates ARM A)", () => {
  assertArmEqual("armA-allbits", [[P1_INPUT, 0xff], [ON_LADDER, 0x01]]);
});

// -- CYCLES (per-arm, absolute -- callees stubbed to isolate loc_1b38's own charge) ----

test("CYCLES: each arm's OWN charge is exactly 31 (A) / 59 (B) / 53 (C) t", () => {
  // Stub 0x1cf2 and 0x1b45 to no-ops on BOTH sides so ONLY loc_1b38's prologue is
  // measured, isolating the collapsed per-arm totals -- including ARM A (unreached in
  // the whole-machine run) -- absolutely and state-independently.
  const A = runBranch([[P1_INPUT, DOWN], [ON_LADDER, 0x01]], translated_1b38, { stubCallees: true });
  const Ao = runBranch([[P1_INPUT, DOWN], [ON_LADDER, 0x01]], optimized_1b38, { stubCallees: true });
  assert.equal(A.cycles, 31, "oracle ARM A prologue must be 31 t (13+8+10)");
  assert.equal(Ao.cycles, 31, "optimized ARM A prologue must be 31 t");
  assert.equal(A.pc, 0x1cf2, "ARM A must end at the jp target 0x1cf2");

  const B = runBranch([[P1_INPUT, 0x00], [ON_LADDER, 0x00]], translated_1b38, { stubCallees: true });
  const Bo = runBranch([[P1_INPUT, 0x00], [ON_LADDER, 0x00]], optimized_1b38, { stubCallees: true });
  assert.equal(B.cycles, 59, "oracle ARM B must be 59 t (13+8+10+13+4+11)");
  assert.equal(Bo.cycles, 59, "optimized ARM B must be 59 t");

  const C = runBranch([[P1_INPUT, 0x04], [ON_LADDER, 0x01]], translated_1b38, { stubCallees: true });
  const Co = runBranch([[P1_INPUT, 0x04], [ON_LADDER, 0x01]], optimized_1b38, { stubCallees: true });
  assert.equal(C.cycles, 53, "oracle ARM C prologue must be 53 t (13+8+10+13+4+5)");
  assert.equal(Co.cycles, 53, "optimized ARM C prologue must be 53 t");
  assert.equal(C.pc, 0x1b45, "ARM C must end at the fall-through target 0x1b45");
  console.log(`  CYCLES: ARM A ${Ao.cycles} t (==31), ARM B ${Bo.cycles} t (==59), ARM C ${Co.cycles} t (==53) -- all == oracle`);
});

// -- TEETH -------------------------------------------------------------------

test("CYCLE-TEETH: dropping ARM B's ret charge yields a wrong total and is CAUGHT", () => {
  const good = runBranch([[P1_INPUT, 0x00], [ON_LADDER, 0x00]], optimized_1b38);
  const dropped = runBranch([[P1_INPUT, 0x00], [ON_LADDER, 0x00]], (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(P1_INPUT); regs.bit(3, regs.a);
    if (regs.fNZ) { m.step(0x1cf2, 31); return m.call(0x1cf2); }
    regs.a = mem.read8(ON_LADDER); regs.and(regs.a);
    if (regs.fZ) { m.ret(0); return; } // DROPPED: the correct ARM-B ret charge is 11 (total 59)
    m.step(0x1b45, 53); return m.call(0x1b45);
  });
  assert.equal(good.cycles, 59, "the correct ARM-B total is 59 t");
  assert.notEqual(dropped.cycles, good.cycles, "cycle-total assertion has no teeth");
  console.log(`  CYCLE-TEETH: correct 59 t vs dropped-ret ${dropped.cycles} t -- caught`);
});

test("TEETH (branch): a twin testing bit 2 instead of bit 3 takes the WRONG arm and is CAUGHT", () => {
  // Input 0x08 (bit 3 = Down set, bit 2 = Up clear), 0x6215=1. The oracle takes ARM A
  // (loc_1cf2 runs, writing RAM); the bit-2 twin sees bit 2 clear -> falls through to ARM C
  // (loc_1b45), a different routine -- a RAM/pc divergence.
  const wrongBit = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(P1_INPUT); regs.bit(2, regs.a); // BUG: bit 2 (Up), not bit 3 (Down)
    if (regs.fNZ) { m.step(0x1cf2, 31); return m.call(0x1cf2); }
    regs.a = mem.read8(ON_LADDER); regs.and(regs.a);
    if (regs.fZ) { m.ret(59); return; }
    m.step(0x1b45, 53); return m.call(0x1b45);
  };
  const o = runBranch([[P1_INPUT, DOWN], [ON_LADDER, 0x01]], translated_1b38);
  const b = runBranch([[P1_INPUT, DOWN], [ON_LADDER, 0x01]], wrongBit);
  const ram = firstStateDiff(o.machine.dumpState(), b.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.ok(ram != null || o.pc !== b.pc, "harness FAILED to catch a wrong branch decision");
  console.log(
    `  TEETH/branch: caught -- ${ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : ""}` +
      `${ram && o.pc !== b.pc ? ", " : ""}${o.pc !== b.pc ? `pc 0x${o.pc.toString(16)} vs 0x${b.pc.toString(16)}` : ""}`,
  );
});

test("TEETH (register file): a twin that corrupts the exit A on the ret arm is CAUGHT", () => {
  // Same control flow, but ARM B's exit A (= 0x6215 value) is corrupted. A is observable
  // (the unit gate compares the whole register file), so a reg diff must name it.
  const corruptExitA = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(P1_INPUT); regs.bit(3, regs.a);
    if (regs.fNZ) { m.step(0x1cf2, 31); return m.call(0x1cf2); }
    regs.a = mem.read8(ON_LADDER); regs.and(regs.a);
    if (regs.fZ) { regs.a ^= 0xff; m.ret(59); return; } // BUG: corrupt the exit A
    m.step(0x1b45, 53); return m.call(0x1b45);
  };
  const o = runBranch([[P1_INPUT, 0x00], [ON_LADDER, 0x00]], translated_1b38);
  const b = runBranch([[P1_INPUT, 0x00], [ON_LADDER, 0x00]], corruptExitA);
  const regs = firstRegDiff(o.machine.regs, b.machine.regs);
  assert.ok(regs != null, "harness FAILED to catch a corrupted exit register");
  assert.equal(regs.reg, "a", `expected the diff at A, got ${regs.reg}`);
  console.log(`  TEETH/regfile: caught at ${regs.reg} (oracle 0x${o.machine.regs.a.toString(16)} vs broken 0x${b.machine.regs.a.toString(16)})`);
});
