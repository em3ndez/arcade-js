// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for entry_1d03 -- the "climb up" arm of the on-ladder animation
 * stepper (ROM 0x1D03-0x1D11). See optimized/entry_1d03.js for the full behaviour block.
 * Two arms, both keyed on MARIO_MOVE_STEP_TIMER (0x620F):
 *   - ARM A -- timer != 0: tail-jump to loc_1d76 (the timer-running branch).
 *   - ARM B -- timer == 0: reset timer := 4, A := 0xFE (delta -2), fall into loc_1d11
 *              (the shared walk/climb body).
 *
 * GATE = STRICT whole-machine, MEASURED. entry_1d03 is ATTRACT-REACHABLE (58 dispatches
 * over 1200 attract frames; first ~f842, once the demo climbs a ladder) and ATOMIC: its
 * sole caller loc_1b45 runs in the loc_197a / entry_1ac3 cascade, mask-cleared inside the
 * vblank NMI -- measured io.nmiMask == 0 at 58/58 dispatches, so the NMI cannot re-enter and
 * no NMI pushed-PC lands in [0x1d03,0x1d11). Its collapse preserves each arm's cycle TOTAL
 * exactly and its one write (0x620F := 4) is work RAM, so it is byte-exact: the STRICT gate
 * passes directly (no convergent gate needed). That gate is timing-sensitive -- a wrong total
 * forks the spin-count PRNG (0x6019) and a later NMI's pushed PC -- so it pins BOTH naturally
 * reached arms' totals (ARM A 46x, ARM B 12x) for free.
 *
 * Jobs:
 *   1. STRICT (whole-machine) -- byte-exact EQUAL vs the oracle over 1200 attract frames,
 *      with the invocation counter proving the override actually fired (58x).
 *   2. STRICT-TEETH (cycles) -- a twin that mischarges ARM A (27->17 t) forks the trajectory
 *      (spin-count PRNG / NMI pushed-PC) and is CAUGHT by the byte-exact gate.
 *   3. EQUAL (unit, natural entry) -- optimized entry_1d03 matches the oracle in RAM + full
 *      register file + pc on the real first dispatch (a climbing state), callees live.
 *   4. FULL-BRANCH COVERAGE -- both arms, forced by identical-both-sides pokes of 0x620F
 *      (the decompiler-pipeline doc reach pattern 3), EQUAL over RAM + regs + pc + SP AND oracle==optimized cycle
 *      total (callees run LIVE, so their effects are covered):
 *        - ARM A: timer=0x03 -> loc_1d76 runs.   ARM A': timer=0x01 -> still loc_1d76
 *          (proves "timer != 0", not a specific value, is the decider).
 *        - ARM B: timer=0x00 -> reset + loc_1d11 runs (Mario steps up).
 *   5. CYCLES (per-arm, absolute) -- with the callees stubbed to no-ops on both sides,
 *      entry_1d03's OWN charge is EXACTLY ARM A 27 t (13+4+10, ends 0x1d76) / ARM B 54 t
 *      (13+4+10+7+13+7, ends 0x1d11). Pins each collapsed total absolutely.
 *   6. CYCLE-TEETH (unit) -- a twin dropping ARM B's fold (54->44 t) yields a wrong total, CAUGHT.
 *   7. TEETH (branch) -- a twin branching on the WRONG condition (fZ, not fNZ) takes ARM B on a
 *      timer!=0 input, CAUGHT as a RAM/pc divergence.
 *   8. TEETH (delta / register) -- a twin handing loc_1d11 the wrong delta (A=0x02 instead of
 *      0xFE) moves Mario the wrong way, CAUGHT as a RAM diff (0x6205) + a register diff (A);
 *      proves A=0xFE is load-bearing.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { entry_1d03 as translated_1d03 } from "../../translated/state0.js";
import { entry_1d03 as optimized_1d03 } from "../entry_1d03.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { MARIO_MOVE_STEP_TIMER, MARIO_Y } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1d03;
const TIMER = MARIO_MOVE_STEP_TIMER; // 0x620F -- the deciding byte
const FRAMES_WHOLE = 1200; // 58 invocations, past the ~f842 first dispatch
const FRAMES_UNIT = 1000; // the unit host must run past ~f842 to capture the first entry

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC, collapse preserves totals) --

test("STRICT (whole-machine): entry_1d03 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_1d03]]));
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

test("STRICT-TEETH (cycles): a wrong ARM-A charge forks the trajectory and is CAUGHT", () => {
  // The load-bearing invariant is per-arm total-cycle preservation. Charging ARM A 17 t
  // instead of 27 shifts the frame's cycle budget -> the spin count 0x6019 (PRNG entropy)
  // and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(TIMER); regs.and(regs.a);
    if (regs.fNZ) { m.step(0x1d76, 17); return m.call(0x1d76); } // DROPPED: correct ARM-A total is 27 t
    mem.write8(TIMER, 0x04); regs.a = 0xfe; m.step(0x1d11, 54); return m.call(0x1d11);
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry) -----------------------------------------------

/** Capture the pristine machine the instant entry_1d03 is first entered (via m.call, deep in
 *  the entry_1ac3 movement cascade). The snapshot override is wired at CONSTRUCTION so it
 *  fires however the routine is reached, then delegates to the oracle so the host proceeds
 *  normally. The captured entry has a LIVE stack (a poppable return address), so the tail
 *  callees' `ret` land on a valid address. (loc_1b38 / loc_1b45 tests do the same.) The
 *  natural first entry is a Mario-climbing state. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1d03(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const ENTRY = ROM_PRESENT ? captureEntry() : null;

const NOOP = () => {}; // stub for a tail callee, to isolate entry_1d03's own cycle charge

/** Clone ENTRY, apply identical-both-sides pokes, optionally stub the tail callees
 *  (0x1d76/0x1d11) to no-ops so ONLY entry_1d03's prologue is measured, run `fn`, and report
 *  the routine's full contract relative to the crafted entry. */
function runBranch(pokes, fn, { stubCallees = false } = {}) {
  const c = ENTRY.clone();
  for (const [a, v] of pokes) c.mem.write8(a, v);
  if (stubCallees) { c.routines.set(0x1d76, NOOP); c.routines.set(0x1d11, NOOP); }
  const c0 = c.cycles;
  const ret = fn(c);
  return { ret, cycles: c.cycles - c0, sp: c.regs.sp, pc: c.pc, machine: c };
}

test("EQUAL (unit): idiomatic entry_1d03 matches translated in RAM + full register file + pc", () => {
  // Natural entry (no poke) -- the real climbing state; the tail callee runs live.
  const o = runBranch([], translated_1d03);
  const p = runBranch([], optimized_1d03);
  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  assert.equal(firstRegDiff(o.machine.regs, p.machine.regs), null, "registers must match");
  assert.equal(o.pc, p.pc, "pc must match");
  assert.equal(o.sp, p.sp, "SP must match");
  console.log("  EQUAL/unit: RAM + full register file (incl. A, F, SP) + pc identical (natural climbing entry)");
});

// -- FULL-BRANCH COVERAGE (crafted identical-both-sides pokes: both arms) -------

/** Prove one arm EQUAL (RAM + full register file + pc + SP) with the callees running LIVE
 *  (so their effects are covered), AND pin its cycle total oracle==optimized. */
function assertArmEqual(label, pokes) {
  const o = runBranch(pokes, translated_1d03);
  const p = runBranch(pokes, optimized_1d03);
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

test("BRANCH: ARM A -- timer != 0 (0x03) -> tail-jump to loc_1d76 (timer-running branch)", () => {
  assertArmEqual("armA-timer03", [[TIMER, 0x03]]);
});

test("BRANCH: ARM A' -- timer = 0x01 -> still loc_1d76 (any nonzero timer is the decider)", () => {
  assertArmEqual("armA-timer01", [[TIMER, 0x01]]);
});

test("BRANCH: ARM B -- timer == 0 -> reset timer := 4, step Mario up via loc_1d11", () => {
  assertArmEqual("armB-timer00", [[TIMER, 0x00]]);
});

// -- CYCLES (per-arm, absolute -- callees stubbed to isolate entry_1d03's own charge) ------

test("CYCLES: each arm's OWN charge is exactly 27 (A) / 54 (B) t", () => {
  // Stub 0x1d76 and 0x1d11 to no-ops on BOTH sides so ONLY entry_1d03's prologue is measured,
  // isolating the collapsed per-arm totals absolutely and state-independently.
  const A = runBranch([[TIMER, 0x03]], translated_1d03, { stubCallees: true });
  const Ao = runBranch([[TIMER, 0x03]], optimized_1d03, { stubCallees: true });
  assert.equal(A.cycles, 27, "oracle ARM A must be 27 t (13+4+10)");
  assert.equal(Ao.cycles, 27, "optimized ARM A must be 27 t");
  assert.equal(A.pc, 0x1d76, "ARM A must end at the jp target 0x1d76");

  const B = runBranch([[TIMER, 0x00]], translated_1d03, { stubCallees: true });
  const Bo = runBranch([[TIMER, 0x00]], optimized_1d03, { stubCallees: true });
  assert.equal(B.cycles, 54, "oracle ARM B must be 54 t (13+4+10+7+13+7)");
  assert.equal(Bo.cycles, 54, "optimized ARM B must be 54 t");
  assert.equal(B.pc, 0x1d11, "ARM B must end at the fall-through target 0x1d11");
  assert.equal(B.machine.mem.read8(TIMER), 0x04, "ARM B must reset the timer to 4");
  console.log(`  CYCLES: ARM A ${Ao.cycles} t (==27), ARM B ${Bo.cycles} t (==54) -- all == oracle`);
});

// -- TEETH -------------------------------------------------------------------

test("CYCLE-TEETH: dropping ARM B's fold charge yields a wrong total and is CAUGHT", () => {
  const good = runBranch([[TIMER, 0x00]], optimized_1d03, { stubCallees: true });
  const dropped = runBranch([[TIMER, 0x00]], (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(TIMER); regs.and(regs.a);
    if (regs.fNZ) { m.step(0x1d76, 27); return m.call(0x1d76); }
    mem.write8(TIMER, 0x04); regs.a = 0xfe; m.step(0x1d11, 44); return m.call(0x1d11); // DROPPED: correct is 54 t
  }, { stubCallees: true });
  assert.equal(good.cycles, 54, "the correct ARM-B total is 54 t");
  assert.notEqual(dropped.cycles, good.cycles, "cycle-total assertion has no teeth");
  console.log(`  CYCLE-TEETH: correct 54 t vs dropped-fold ${dropped.cycles} t -- caught`);
});

test("TEETH (branch): a twin branching on the WRONG condition takes the WRONG arm and is CAUGHT", () => {
  // Input timer=0x03: oracle takes ARM A (loc_1d76 runs). The fZ twin sees Z clear -> falls to
  // ARM B (resets 0x620F to 4, loc_1d11 moves Mario) -- a RAM/pc divergence.
  const wrongBranch = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(TIMER); regs.and(regs.a);
    if (regs.fZ) { m.step(0x1d76, 27); return m.call(0x1d76); } // BUG: fZ instead of fNZ
    mem.write8(TIMER, 0x04); regs.a = 0xfe; m.step(0x1d11, 54); return m.call(0x1d11);
  };
  const o = runBranch([[TIMER, 0x03]], translated_1d03);
  const b = runBranch([[TIMER, 0x03]], wrongBranch);
  const ram = firstStateDiff(o.machine.dumpState(), b.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.ok(ram != null || o.pc !== b.pc, "harness FAILED to catch a wrong branch decision");
  console.log(
    `  TEETH/branch: caught -- ${ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : ""}` +
      `${ram && o.pc !== b.pc ? ", " : ""}${o.pc !== b.pc ? `pc 0x${o.pc.toString(16)} vs 0x${b.pc.toString(16)}` : ""}`,
  );
});

test("TEETH (delta/register): a twin handing loc_1d11 the wrong delta (A=0x02) is CAUGHT", () => {
  // ARM B passes the delta to loc_1d11 in A. Handing +2 instead of -2 (0xFE) moves Mario the
  // wrong way: MARIO_Y (0x6205) diverges and the exit A diverges -- proves A=0xFE is load-bearing.
  const wrongDelta = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(TIMER); regs.and(regs.a);
    if (regs.fNZ) { m.step(0x1d76, 27); return m.call(0x1d76); }
    mem.write8(TIMER, 0x04); regs.a = 0x02; m.step(0x1d11, 54); return m.call(0x1d11); // BUG: +2, not -2
  };
  const o = runBranch([[TIMER, 0x00]], translated_1d03);
  const b = runBranch([[TIMER, 0x00]], wrongDelta);
  const ram = firstStateDiff(o.machine.dumpState(), b.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  const regs = firstRegDiff(o.machine.regs, b.machine.regs);
  assert.ok(ram != null, "harness FAILED to catch the wrong delta as a RAM divergence");
  assert.ok(regs != null, "harness FAILED to catch the wrong delta as a register divergence");
  console.log(`  TEETH/delta: caught -- RAM diff at 0x${(ram.addr ?? 0).toString(16)} (MARIO_Y=0x${MARIO_Y.toString(16)}), reg diff at ${regs.reg}`);
});
