// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for loc_1e7a (the Mario-Y guard in the 0x1E57
 * sprite-orientation family). A LEAF -- not a dispatch target -- reached ONLY via a
 * tail `jp c,0x1e7a` from sub_1e57, which runs inside the interruptible per-frame
 * update cascade loc_197a. On entry register A holds Mario's Y (sub_1e57 loads it
 * from MARIO_Y 0x6205 before the jump). The unit gate reaches it because the snapshot
 * override is installed at CONSTRUCTION, so it fires however the routine is entered
 * (dispatch OR m.call).
 *
 * The routine has TWO branches, keyed on `cp 0x31`:
 *   - NO-CARRY (A >= 0x31, Mario at/below row 0x31): `ret nc`, 18 t. This is the
 *     ONLY branch reached in attract -- all 816 dispatches take it (Mario's Y is
 *     0xF0 at the natural entry).
 *   - CARRY (A < 0x31, Mario above row 0x31): fall into loc_1e6d with carry SET;
 *     loc_1e6d writes 0x694D := 0 and loc_1e85 latches GAME_SUBSTATE (0x600A) := 0x16
 *     and UNWINDS. 102 t incl. that tail cascade. NEVER taken in attract -- SYNTHESISED.
 *
 * Seven jobs:
 *
 *   1. CONVERGENT (whole-machine) -- loc_1e7a runs in the INTERRUPTIBLE loc_197a
 *      cascade, so the strict byte-exact gate can false-fail on a mistimed-NMI raster
 *      tear + the coarse PC pushed into the dead stack. The convergent gate is the
 *      correct license. It runs the ATTRACT scenario, which dispatches loc_1e7a ~600x
 *      (all no-carry). The no-carry arm matches the oracle charge-for-charge, so it
 *      converges (this proves the exercised path equivalent; the carry arm's collapse
 *      question is moot because that arm is kept per-instruction -- see the routine).
 *
 *   2. DISPATCH -- the override must actually fire, or EQUAL is vacuous. loc_1e7a
 *      fires hundreds of times in the attract window; the first natural entry is at
 *      frame ~584 with A=0xF0 (the no-carry arm).
 *
 *   3. EQUAL (unit) -- translated vs optimized leave identical RAM + registers
 *      (incl. F -- the `cp 0x31` result is the returned flag state) + pc, from the
 *      captured natural entry. maxFrames=640 because the first entry is at frame ~584,
 *      past the unit gate's 240-frame default.
 *
 *   4. BRANCH + CONTRACT COVERAGE -- BOTH arms are proven EQUAL by driving register A
 *      identically on both sides, then diffing RAM + regs + pc AND the exact SP and
 *      CYCLE TOTAL:
 *        - A=0x80 (>= 0x31): no-carry, ret nc,          18 t
 *        - A=0x00 (<  0x31): carry, into loc_1e6d tail, 102 t
 *      The carry arm's 102 t includes loc_1e6d + loc_1e85 -- the harness machine
 *      resolves 0x1e6d to the frozen oracle (no manifest is loaded here), so the total
 *      is deterministic. A dropped m.step charge is CAUGHT (job 5).
 *
 *   5. BRANCH-TEETH (cycles) -- a variant that drops one m.step charge yields a wrong
 *      total and is CAUGHT, proving the cycle-total assertion has teeth.
 *
 *   6. TEETH (convergent) -- a cycle-broken twin (the exercised no-carry arm charged
 *      5 t short) shifts the main loop's spin count 0x6019 (PRNG entropy), forking the
 *      RANDOM stream PERMANENTLY; the convergent gate CATCHES it as a PERSISTENT
 *      non-stack divergence.
 *
 *   7. TEETH (unit, behavioural) -- loc_1e7a writes no RAM of its own, so the teeth is
 *      a WRONG-BRANCH twin: one that ignores the carry and always falls into loc_1e6d.
 *      On the natural no-carry entry the correct routine `ret`s but the twin runs the
 *      loc_1e6d/loc_1e85 tail, latching GAME_SUBSTATE (0x600A). That is CAUGHT:
 *      NOT-EQUAL, first diverging at 0x600A.
 *
 * THE CYCLE DECISION this routine records: loc_1e7a is kept at the oracle's per-branch
 * granularity, which is ALREADY minimal (nothing to collapse). The no-carry arm is
 * one m.step + one m.ret. The carry arm is KEPT PER-INSTRUCTION rather than collapsed:
 * it is interruptible (loc_197a cascade) AND never exercised by the convergent attract
 * run (0 of 816 dispatches), so a collapse of it cannot be whole-machine verified --
 * docs/decompiler-pipeline keeps such an arm split. All effects on the carry arm are in the callees
 * (0x694D, 0x600A -- WORK RAM, not 0x7Dxx hardware latches), so there is NO hardware
 * bus cycle to pin and NO write-trace test.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1e7a as translated_1e7a } from "../../translated/state0.js";
import { loc_1e7a as optimized_1e7a } from "../loc_1e7a.js";
import { unitEquivalence } from "../harness.js";
import { convergentGate, SCENARIOS } from "./convergent.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { Machine } from "../../machine.js";
import { GAME_SUBSTATE } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1e7a;
const CAPTURE_FRAMES = 640; // first natural (attract) entry is at frame ~584

// Per-arm cycle totals (measured from the oracle; the carry arm includes the
// deterministic loc_1e6d + loc_1e85 tail cascade).
const NC_CYCLES = 18;  // cp 7 + ret nc 11
const C_CYCLES = 102;  // cp 7 + ret-nc-not-taken 5 + jp 10 + loc_1e6d 40 + loc_1e85 40

/**
 * Cycle-broken twin for the CONVERGENT gate: identical memory + registers to the
 * optimized routine, but the EXERCISED no-carry arm is charged 5 t short (2 instead
 * of 7 for the `cp`). Wrong totals shift the spin count 0x6019 (the PRNG entropy),
 * forking the RANDOM stream -- a PERSISTENT non-stack divergence, never a heal. Teeth
 * for the load-bearing invariant (total-cycle preservation on the exercised path).
 */
function cyclebroken_1e7a(m) {
  const { regs } = m;
  regs.cp(0x31);
  m.step(0x1e7c, 2); // DROPPED: the correct charge here is 7 t
  if (!regs.fC) { m.ret(11); return true; }
  m.step(0x1e7d, 5);
  m.step(0x1e6d, 10);
  return m.call(0x1e6d);
}

/**
 * Deliberately-broken twin (BEHAVIOURAL): computes the `cp` correctly but IGNORES the
 * carry and ALWAYS falls into loc_1e6d. On the natural no-carry entry the correct
 * routine returns, while this twin runs the loc_1e6d/loc_1e85 tail and latches
 * GAME_SUBSTATE (0x600A) -- a wrong-control-flow bug the unit gate must catch. (The
 * carry arm itself is left verbatim so the divergence is purely the taken branch.)
 */
function broken_1e7a(m) {
  const { regs } = m;
  regs.cp(0x31);
  m.step(0x1e7c, 7);
  m.step(0x1e7d, 5);
  m.step(0x1e6d, 10);
  return m.call(0x1e6d);
}

/** Capture the pristine machine the instant loc_1e7a is first entered (via m.call).
 *  A constructor override snapshots the entry, then delegates to the translated
 *  oracle so the host run proceeds normally to a clean stop. */
function captureEntry(maxFrames = CAPTURE_FRAMES) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1e7a(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}

/** Clone `entry`, set A := `fillA` (the routine's only input), run `fn`, and report
 *  the full contract: the resulting SP + PC, the machine, and the cycles the routine
 *  charged (relative to entry, so it is base-independent). */
function runArm(entry, fillA, fn) {
  const c = entry.clone();
  c.regs.a = fillA;
  const c0 = c.cycles;
  const ret = fn(c);
  return { ret, cycles: c.cycles - c0, sp: c.regs.sp, pc: c.pc, machine: c };
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine): optimized loc_1e7a CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  // loc_1e7a is INTERRUPTIBLE (loc_197a cascade), so the strict byte-exact gate can
  // false-fail on a mistimed-NMI raster tear + the coarse PC pushed into the dead
  // stack. The convergent gate is the correct license. ATTRACT dispatches it ~600x
  // (all no-carry); GAMEPLAY's default scenario also runs the cascade but attract is
  // where the routine is dense, matching the pre-measured 816/1400.
  const r = convergentGate(new Map([[TARGET, optimized_1e7a]]), { scenario: SCENARIOS.attract });

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
      `${r.pixDiffFrames} tear frame(s) (max ${r.maxPixels}px, healed), ` +
      `non-stack state persistent = ${r.statePersistent.length}`,
  );
});

test("EQUAL (unit): idiomatic optimized loc_1e7a matches translated in RAM + registers", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_1e7a, optimized_1e7a, { maxFrames: CAPTURE_FRAMES });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F, A, SP) + pc identical (natural no-carry entry)");
});

// -- BRANCH + CONTRACT COVERAGE ----------------------------------------------

/** Prove one arm EQUAL across the WHOLE contract at a chosen A: RAM, registers, pc,
 *  SP, and the cycle total (== oracle == pinned absolute, so a wrong total has
 *  committed teeth). */
function assertArmEqual(label, fillA, expectCycles) {
  const entry = captureEntry();
  const o = runArm(entry, fillA, translated_1e7a);
  const p = runArm(entry, fillA, optimized_1e7a);

  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(o.machine.regs, p.machine.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(o.pc, p.pc, "pc must match between oracle and optimized");
  assert.equal(o.sp, p.sp, "SP must match the oracle");
  assert.equal(o.cycles, p.cycles, "cycle total must match the oracle");
  assert.equal(o.cycles, expectCycles, `oracle cycle total should be ${expectCycles} t on this arm`);
  console.log(
    `  BRANCH/${label}: EQUAL -- A=0x${fillA.toString(16)}, SP 0x${p.sp.toString(16)}, ${p.cycles} t, ` +
      `pc 0x${p.pc.toString(16)}, ret=${p.ret}`,
  );
}

test("BRANCH (unit): A >= 0x31 -- no carry, ret nc, 18 t", () => {
  assertArmEqual("no-carry", 0x80, NC_CYCLES);
});

test("BRANCH (unit): A < 0x31 -- carry, into loc_1e6d tail (0x694D:=0, 0x600A:=0x16, unwind), 102 t", () => {
  assertArmEqual("carry", 0x00, C_CYCLES);
});

test("BRANCH-TEETH (cycles): a dropped m.step charge yields a wrong total and is CAUGHT", () => {
  const entry = captureEntry();
  const good = runArm(entry, 0x80, optimized_1e7a);
  // A no-carry variant that drops the `cp` 7 t charge to 2 t -- same RAM/regs, wrong total.
  const dropped = runArm(entry, 0x80, (m) => {
    const { regs } = m;
    regs.cp(0x31);
    m.step(0x1e7c, 2); // dropped 5 t
    if (!regs.fC) { m.ret(11); return true; }
    m.step(0x1e7d, 5); m.step(0x1e6d, 10); return m.call(0x1e6d);
  });
  assert.equal(good.cycles, NC_CYCLES, `the correct no-carry total is ${NC_CYCLES} t`);
  assert.notEqual(dropped.cycles, good.cycles, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH: correct ${good.cycles} t vs dropped-charge ${dropped.cycles} t -- caught`);
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  // The convergent gate tolerates transient tears but MUST catch a real (non-healing)
  // error. The load-bearing invariant is total-cycle preservation on the EXERCISED
  // no-carry arm; a short charge shifts the spin count 0x6019 (PRNG entropy), forking
  // the RANDOM stream permanently.
  const r = convergentGate(new Map([[TARGET, cyclebroken_1e7a]]), { scenario: SCENARIOS.attract });

  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.pass, false, "convergent gate FAILED to catch a wrong cycle total -- it is worthless");
  assert.ok(
    r.statePersistent.length > 0 || r.pixelPersistent,
    "a caught divergence must be persistent (non-stack state or pixels)",
  );
  console.log(
    `  TEETH/convergent: caught -- persistent non-stack addrs ${r.statePersistent.length}` +
      `${r.statePersistent.length ? " (" + r.statePersistent.slice(0, 4).map((s) => "0x" + s.addr.toString(16)).join(",") + ")" : ""}, ` +
      `pixelPersistent ${r.pixelPersistent}`,
  );
});

test("TEETH (unit, behavioural): a WRONG-BRANCH twin (always falls into loc_1e6d) is CAUGHT and names 0x600A", () => {
  // On the natural no-carry entry the correct routine `ret`s; the twin instead runs
  // the loc_1e6d/loc_1e85 tail and latches GAME_SUBSTATE (0x600A) := 0x16. The unit
  // gate must catch that as a RAM divergence, first at 0x600A (< the sprite byte
  // 0x694D and < the stack).
  const entry = captureEntry();
  const a = entry.clone();
  const b = entry.clone();
  translated_1e7a(a);
  broken_1e7a(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));

  assert.ok(ram != null, "harness FAILED to catch a wrong branch -- it is worthless");
  assert.equal(
    ram.addr, GAME_SUBSTATE,
    `expected first diff at GAME_SUBSTATE 0x${GAME_SUBSTATE.toString(16)}, got 0x${ram.addr.toString(16)}`,
  );
  console.log(`  TEETH/unit: caught at 0x${ram.addr.toString(16)} (translated ${ram.a} vs broken ${ram.b})`);
});
