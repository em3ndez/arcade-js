// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for loc_1ceb (ROM 0x1CEB): decrement Mario's walk/climb
 * sub-step timer MARIO_MOVE_STEP_TIMER (0x620F), then TAIL-JUMP into the player-sprite
 * copy entry_1da6 (0x1DA6). A LEAF tail in the ground-move step -- not a dispatch
 * target -- reached only via a tail `jp 0x1ceb` from loc_1cd2 (both its `jp nz` arm and
 * its fall-through end), which loc_1c8f/loc_1cab reach, and which the interruptible
 * per-frame update cascade loc_197a dispatches. The unit gate reaches it because the
 * snapshot override is installed at CONSTRUCTION, so it fires however the routine is
 * entered (dispatch OR m.call).
 *
 * Six jobs:
 *
 *   1. CONVERGENT (whole-machine) -- loc_1ceb is COLLAPSED (one m.step for its whole
 *      straight-line block) and INTERRUPTIBLE, so the strict byte-exact gate would
 *      false-fail on a mistimed-NMI raster tear + the coarse PC pushed into the dead
 *      stack. The convergent gate is the correct license. It runs the ATTRACT scenario
 *      (the demo play walks Mario, dispatching this routine 221x over 1200 frames; the
 *      first natural entry is ~frame 620).
 *
 *   2. DISPATCH -- the override must actually fire, or CONVERGENT is vacuous. loc_1ceb
 *      fires 221x in the attract window.
 *
 *   3. EQUAL (unit) -- translated vs optimized leave identical RAM + registers (incl.
 *      F, which entry_1da6's `inc l` overwrites, so the dropped `dec` flags do not
 *      matter -- see loc_1ceb.js FLAGS) + pc, from the captured natural entry.
 *      maxFrames=700 because the first entry is ~frame 620, past the unit gate's
 *      240-frame default.
 *
 *   4. CONTRACT COVERAGE + CYCLE TOTAL -- loc_1ceb has NO data-dependent branch (a
 *      single basic block), so there is one arm and nothing to synthesise for control
 *      flow. But its observable effect is a decrement of the LIVE 0x620F value, so the
 *      arm is driven at the natural entry value AND at synthesised values 0x00 (the
 *      0 -> 0xFF Z80 `dec` WRAP -- a hardcoded 0 or a wrong wrap is caught here) and
 *      0x05 on BOTH sides: RAM (0x620F := value-1) + regs + pc + SP identical, and the
 *      collapsed arm's CYCLE TOTAL equals the oracle's AND the pinned absolute 143 t
 *      (loc_1ceb's own 31 t + the deterministic entry_1da6 tail, timer-independent).
 *
 *   5. BRANCH-TEETH (cycles) -- a variant that drops 5 t from the block charge yields a
 *      wrong total (138 vs 143) and is CAUGHT, proving the cycle-total assertion has teeth.
 *
 *   6a. TEETH (convergent) -- a cycle-broken twin (5 t short) shifts the main loop's
 *       spin count 0x6019 (the PRNG entropy), forking the RANDOM stream PERMANENTLY; the
 *       convergent gate CATCHES it as a PERSISTENT non-stack divergence.
 *   6b. TEETH (unit, value) -- a broken twin whose store (to 0x620F) lands the wrong
 *       value (correct XOR 0xFF) is CAUGHT: NOT-EQUAL, naming 0x620F.
 *
 * THE CYCLE DECISION this routine records: loc_1ceb is COLLAPSED to ONE m.step. Its
 * three instruction charges (10+11+10 = 31 t, exit PC 0x1da6) fold into a single charge;
 * total-preservation keeps the spin count / PRNG deterministic. It is NOT atomic (the
 * NMI can land in its 31 t window via the loc_197a cascade), so the collapse is LICENSED
 * by the CONVERGENT gate, not the strict one. The single store is WORK RAM (0x620F) --
 * no 0x7Dxx hardware latch -- so there is NO hardware bus cycle to pin and NO write-trace
 * test.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1ceb as translated_1ceb } from "../../translated/state0.js";
import { loc_1ceb as optimized_1ceb } from "../loc_1ceb.js";
import { unitEquivalence } from "../harness.js";
import { convergentGate, SCENARIOS } from "./convergent.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { Machine } from "../../machine.js";
import { MARIO_MOVE_STEP_TIMER } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1ceb;
const CAPTURE_FRAMES = 700; // first natural (attract) entry is ~frame 620
const PINNED_CYCLES = 143;  // loc_1ceb's own 31 t + the deterministic entry_1da6 tail

/**
 * Deliberately-broken twin: behaviourally the optimized routine EXCEPT the first store
 * (to 0x620F) lands a wrong value (correct XOR 0xFF, guaranteed to differ). Catches a
 * "wrong value to the routine's own output address" bug. The rest of the routine and the
 * entry_1da6 tail run verbatim.
 */
function broken_1ceb(m) {
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
    return optimized_1ceb(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

/**
 * Cycle-broken twin for the CONVERGENT gate: identical memory + registers to the
 * collapsed routine, but the block charge is 5 t short, so the path total no longer
 * matches the oracle. Wrong totals shift the spin count (0x6019, the PRNG entropy),
 * forking the RANDOM stream -- a PERSISTENT non-stack divergence, never a heal. Teeth
 * for the collapse's load-bearing invariant (total-cycle preservation).
 */
function cyclebroken_1ceb(m) {
  const { mem } = m;
  const timer = mem.read8(MARIO_MOVE_STEP_TIMER);
  mem.write8(MARIO_MOVE_STEP_TIMER, (timer - 1) & 0xff);
  m.step(0x1da6, 26); // DROPPED: the correct charge here is 31 t
  return m.call(0x1da6);
}

/** Capture the pristine machine the instant loc_1ceb is first entered (via m.call). A
 *  constructor override snapshots the entry, then delegates to the translated oracle so
 *  the host run proceeds normally to a clean stop. */
function captureEntry(maxFrames = CAPTURE_FRAMES) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1ceb(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}

/** Clone `entry`, set 0x620F := `timer`, run `fn`, and report the full contract: the
 *  resulting SP + PC, the machine, and the cycles the routine charged (relative to
 *  entry, so it is base-independent). */
function runWithTimer(entry, timer, fn) {
  const c = entry.clone();
  c.mem.write8(MARIO_MOVE_STEP_TIMER, timer);
  const c0 = c.cycles;
  const ret = fn(c);
  return { ret, cycles: c.cycles - c0, sp: c.regs.sp, pc: c.pc, machine: c };
}

// -- CONVERGENT + EQUAL -------------------------------------------------------

test("CONVERGENT (whole-machine): collapsed loc_1ceb CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  // loc_1ceb is COLLAPSED and INTERRUPTIBLE; the ATTRACT scenario reaches it (221x).
  const r = convergentGate(new Map([[TARGET, optimized_1ceb]]), { scenario: SCENARIOS.attract });

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

test("EQUAL (unit): idiomatic optimized loc_1ceb matches translated in RAM + registers", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_1ceb, optimized_1ceb, { maxFrames: CAPTURE_FRAMES });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F, HL, SP) + pc identical (natural entry)");
});

// -- CONTRACT COVERAGE + CYCLE TOTAL -----------------------------------------

/** Prove the single arm EQUAL across the WHOLE contract at a chosen timer value:
 *  RAM (0x620F := timer-1) + registers + pc + SP + collapsed cycle total (== oracle
 *  == pinned absolute). A hardcoded 0 or a wrong 0 -> 0xFF wrap is caught at timer=0. */
function assertContract(timer) {
  const entry = captureEntry();
  const o = runWithTimer(entry, timer, translated_1ceb);
  const p = runWithTimer(entry, timer, optimized_1ceb);

  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(o.machine.regs, p.machine.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(o.pc, p.pc, "pc must match between oracle and optimized");
  assert.equal(o.sp, p.sp, "SP must match the oracle");

  // The routine decrements the LIVE 0x620F -- assert directly too (mod-256 wrap).
  assert.equal(
    p.machine.mem.read8(MARIO_MOVE_STEP_TIMER), (timer - 1) & 0xff,
    `0x620F must be decremented to 0x${((timer - 1) & 0xff).toString(16)}`,
  );

  // Collapsed-arm cycle total: == oracle, and pinned absolute (structural teeth).
  assert.equal(o.cycles, p.cycles, "cycle total must match the oracle");
  assert.equal(o.cycles, PINNED_CYCLES, `oracle cycle total should be ${PINNED_CYCLES} t`);
  console.log(
    `  CONTRACT/timer=0x${timer.toString(16)}: EQUAL -- SP 0x${p.sp.toString(16)}, ${p.cycles} t, ` +
      `0x620F = 0x${((timer - 1) & 0xff).toString(16)}`,
  );
}

test("CONTRACT (unit): natural entry timer -- decremented, SP + cycle total 143 t", () => {
  const entry = captureEntry();
  assertContract(entry.mem.read8(MARIO_MOVE_STEP_TIMER));
});

test("CONTRACT (unit): synthesised timer=0x00 -- 0 -> 0xFF Z80 dec WRAP, 143 t", () => {
  assertContract(0x00);
});

test("CONTRACT (unit): synthesised timer=0x05 -- plain decrement to 0x04, 143 t", () => {
  assertContract(0x05);
});

test("BRANCH-TEETH (cycles): a dropped m.step charge yields a wrong total and is CAUGHT", () => {
  const entry = captureEntry();
  const good = runWithTimer(entry, 0x05, optimized_1ceb);
  const dropped = runWithTimer(entry, 0x05, cyclebroken_1ceb); // 5 t short
  assert.equal(good.cycles, PINNED_CYCLES, `the correct total is ${PINNED_CYCLES} t`);
  assert.notEqual(dropped.cycles, good.cycles, "cycle-total assertion has no teeth");
  assert.equal(good.cycles - dropped.cycles, 5, "the 5 t drop must be exactly the difference the twin injects");
  console.log(`  BRANCH-TEETH: correct ${good.cycles} t vs dropped-charge ${dropped.cycles} t -- caught`);
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  // The convergent gate tolerates transient tears but MUST catch a real (non-healing)
  // error. The collapse's load-bearing invariant is total-cycle preservation; a short
  // charge shifts the spin count 0x6019 (PRNG entropy), forking the RANDOM stream.
  const r = convergentGate(new Map([[TARGET, cyclebroken_1ceb]]), { scenario: SCENARIOS.attract });

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

test("TEETH (unit): a wrong 0x620F store is CAUGHT and names 0x620F", () => {
  const entry = captureEntry();

  const a = entry.clone();
  const b = entry.clone();
  translated_1ceb(a);
  broken_1ceb(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));

  assert.ok(ram != null, "harness FAILED to catch a wrong store -- it is worthless");
  assert.equal(
    ram.addr, MARIO_MOVE_STEP_TIMER,
    `expected first diff at the broken address 0x${MARIO_MOVE_STEP_TIMER.toString(16)}, got 0x${ram.addr.toString(16)}`,
  );
  console.log(`  TEETH/unit: caught at 0x${ram.addr.toString(16)} (translated ${ram.a} vs broken ${ram.b})`);
});
