// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for sub_0018 (the `rst 0x18` skip helper: a "do it
 * every Nth frame" gate that ticks the sub-state countdown at 0x6009 and, unless
 * it expired, discards the caller's remainder by unwinding one stack level).
 *
 * sub_0018 is a LEAF reached only via `m.call(0x0018)` from ~50 sites (and
 * tail-jumped into by sub_0020) -- never a dispatch target. The unit gate installs
 * its snapshot override at CONSTRUCTION, so it captures the entry however the
 * routine is first reached (README / core/equivalence.js). Because it is called
 * constantly, the whole-machine override fires OFTEN.
 *
 * Jobs:
 *
 *   1. CONVERGENT (whole-machine) -- the collapsed optimized sub_0018 CONVERGES
 *      against its translated oracle (pixels + persistent non-stack state). sub_0018
 *      is collapsed and INTERRUPTIBLE (see optimized/sub_0018.js), so the whole-machine
 *      job runs under the convergent gate, per the lead's unconditional rule: any
 *      routine with a whole-machine test gets the convergent gate, not the strict one.
 *      The unit gate (below) still compares RAM + the WHOLE register file (incl.
 *      SP + F + PC) from a single crafted entry, which is where sub_0018's contract
 *      lives: its SP manipulation and the boolean-carrying Z flag must match exactly.
 *
 *   2. DISPATCH -- the override must actually fire, or CONVERGENT/EQUAL is vacuous.
 *      In pure attract sub_0018 first fires at frame ~262 (a SKIP) and again at ~518
 *      (an EXPIRY); the attract scenario fires it many times and exercises BOTH
 *      branches naturally.
 *
 *   3. TEETH (convergent + RAM) -- convergent: a CYCLE-DROP twin (one charge short)
 *      forks the main-loop spin count (0x6019 PRNG entropy), a PERSISTENT divergence,
 *      CAUGHT. RAM: a deliberately-broken twin (the routine's only store, `dec (hl)`
 *      to 0x6009, lands the wrong value) must be CAUGHT: NOT-EQUAL, naming 0x6009
 *      (inside the compared dump's work RAM 0x6000-0x6BFF).
 *
 *   4+5. BRANCH + CYCLE TEETH -- sub_0018 has TWO data-dependent branches
 *      (counter EXPIRED -> normal return true; counter STILL TICKING -> stack
 *      unwind + return false). Each is proven EQUAL (RAM + regs incl SP + PC +
 *      the boolean return) from a synthesised entry, AND each asserts its
 *      PER-INSTRUCTION T-state total equals the oracle's (EXPIRY 32 t, SKIP 48 t).
 *      A wrong total would shift the main-loop spin count / a downstream NMI's
 *      landing (README §2); the cycle teeth guard it.
 *
 *   6. TEETH (SP) -- sub_0018's whole point is the stack unwind, which the RAM-only
 *      diff cannot see; a wrong-SP twin (leaves SP one byte off) must be CAUGHT in
 *      the REGISTER file (SP). Like the sub_0008/0010 SP teeth.
 *
 *   7. TEETH (cycle) -- a mis-timed twin (same final state, +4 t) must be CAUGHT by
 *      the per-branch cycle-total comparison, proving the cycle assertions above are
 *      not vacuous now that the charges are collapsed to per-branch totals.
 *
 * CYCLE FINDING: sub_0018 is a leaf but is NOT atomic on every path -- it is reached
 * from INTERRUPTIBLE contexts (sibling sub_0020's expiry tail-jump and many in-game
 * substate callers), not only the mask-cleared NMI-dispatch path. On an interruptible
 * path the vblank NMI can be accepted at an instruction boundary INSIDE the routine,
 * and fireNmi pushes the CURRENT PC into diffed stack RAM; collapsing the charges
 * (see optimized/sub_0018.js) moves where that PC lands, which is exactly what the
 * CONVERGENT gate is for -- pixels + persistent non-stack state are the ground truth,
 * a healing dead-stack/pixel tear is tolerated, a real (non-healing) divergence still
 * fails. The per-branch cycle TOTALS (expiry 32 t, skip 48 t) are preserved exactly
 * and still asserted below.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_0018 as translated_0018 } from "../../translated/nmi.js";
import { sub_0018 as optimized_0018 } from "../sub_0018.js";
import { Machine } from "../../machine.js";
import { SUBSTATE_TIMER } from "../ram.js";
import { convergentGate, SCENARIOS } from "./convergent.js";
import {
  unitEquivalence,
  firstStateDiff,
  firstRegDiff,
} from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0018;
const MAX_FRAMES = 400;  // unit gate reaches the first entry (frame ~262) comfortably

// The makeMachine factory the core engine drives (same shape as harness.js's
// dkMachineFactory). Pure attract -- sub_0018 fires from boot with no input, so
// no tape is needed; both baseline and optimized get the identical (empty) input.
function makeMachine(overrides) {
  return new Machine(ROM, overrides ? { overrides } : {});
}

// sub_0018's ONLY store: `dec (hl)` to 0x6009 (SUBSTATE_TIMER), inside the
// compared dump's work RAM (0x6000-0x6BFF). This is the routine's single output
// address -- corrupting it is the representative "wrong value to the routine's
// own output" bug the gate must catch.
const BROKEN_ADDR = SUBSTATE_TIMER; // 0x6009

/**
 * Deliberately-broken twin: behaviourally optimized_0018 EXCEPT the store to
 * 0x6009 lands a wrong value (correct byte XOR 0xFF, guaranteed to differ).
 * `broke` is per-call, so every invocation's single store is corrupted -- but the
 * diff surfaces at 0x6009 the very frame it happens, so the run is caught before a
 * corrupted counter can cascade into an unhealthy state.
 */
function broken_0018(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke && addr === BROKEN_ADDR) {
      broke = true;
      return realWrite(addr, value ^ 0xff, busOffset);
    }
    return realWrite(addr, value, busOffset);
  };
  try {
    return optimized_0018(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

/**
 * Deliberately WRONG-SP twin: optimized_0018 that leaves SP one byte off. sub_0018's
 * whole purpose is the stack unwind, so this is the representative "got the SP math
 * wrong" bug -- it writes the SAME RAM (0x6009) and returns the SAME boolean, so ONLY
 * the register file (SP) catches it. Like the sub_0008/0010 SP teeth.
 */
function wrongSp_0018(m) {
  const ret = optimized_0018(m);
  m.regs.sp = (m.regs.sp + 1) & 0xffff; // BUG: SP left one byte off the oracle
  return ret;
}

/**
 * Deliberately MIS-TIMED twin: optimized_0018 with one spurious 4 t charge. Its final
 * state (RAM / regs / pc / return) is identical, but the cycle total is wrong -- so it
 * must be caught by the per-branch cycle-total comparison, proving those cycle
 * assertions are not vacuous now that the charges are collapsed to per-branch totals.
 */
function misTimed_0018(m) {
  m.step(TARGET, 4); // spurious charge; pc immediately overwritten by the real routine
  return optimized_0018(m);
}

/**
 * Cycle-broken twin for the CONVERGENT gate: identical memory + registers to the
 * collapsed routine, but the SKIP path's total is 5 t short, so the main loop's spin
 * count (0x6019 PRNG entropy) forks -- a PERSISTENT divergence, never a heal.
 */
function cyclebroken_0018(m) {
  const { regs, mem } = m;
  regs.hl = SUBSTATE_TIMER;
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)), 8);
  if (regs.fZ) {
    m.ret(32);
    return true;
  }
  regs.sp = (regs.sp + 1) & 0xffff;
  regs.sp = (regs.sp + 1) & 0xffff;
  m.ret(43); // DROPPED: correct SKIP total is 48 t
  return false;
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine): collapsed sub_0018 CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_0018]]), { scenario: SCENARIOS.attract });

  // The override must actually have run, or CONVERGENT would be vacuous.
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
    `  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x (both branches: skip + expiry); ` +
      `${r.pixDiffFrames} tear frame(s) (max ${r.maxPixels}px, healed), ` +
      `non-stack state persistent = ${r.statePersistent.length}`,
  );
});

test("EQUAL (unit): idiomatic optimized sub_0018 matches translated in RAM + registers (incl. SP + F)", () => {
  const r = unitEquivalence(makeMachine, TARGET, translated_0018, optimized_0018, { maxFrames: MAX_FRAMES });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. SP, F) + pc identical");
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  // The convergent gate tolerates transient tears but MUST catch a real (non-healing) error.
  // A short SKIP-path charge shifts the spin count 0x6019 (PRNG entropy), forking the RANDOM
  // stream permanently -- never a value-corruption twin here (it would hang a long run).
  const r = convergentGate(new Map([[TARGET, cyclebroken_0018]]), { scenario: SCENARIOS.attract });

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

test("TEETH (unit): a wrong countdown store is CAUGHT and names 0x6009", () => {
  const r = unitEquivalence(makeMachine, TARGET, translated_0018, broken_0018, { maxFrames: MAX_FRAMES });

  assert.equal(r.equal, false, "harness FAILED to catch a wrong store — it is worthless");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  assert.equal(
    r.ram.addr,
    BROKEN_ADDR,
    `expected first diff at the broken address 0x${BROKEN_ADDR.toString(16)}, got 0x${r.ram.addr.toString(16)}`,
  );
  console.log(
    `  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`,
  );
});

// -- BRANCH + CYCLE TEETH -----------------------------------------------------

// Capture the pristine machine at sub_0018's first entry (frame ~262), via the
// same construction-time snapshot the core unit gate uses. Both synthesised
// branches are forced from clones of this ONE captured entry by poking 0x6009.
function captureEntry() {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_0018(mm); // let the host run proceed to a clean stop
  }]]);
  const host = makeMachine(snap);
  host.runFrames(MAX_FRAMES);
  if (entry === null) throw new Error(`sub_0018 never entered within ${MAX_FRAMES} frames`);
  return entry;
}

/**
 * Run oracle vs optimized on two clones of `entry` with 0x6009 poked to
 * `timerValue` (identically on both sides), and return the branch's EQUAL result
 * (RAM + regs incl SP + PC), the boolean return value from each, and the T-state
 * total charged by each. `timerValue` of 1 forces the EXPIRY branch (dec -> 0),
 * any value > 1 forces the SKIP branch (dec -> non-zero).
 */
function runBranch(entry, timerValue) {
  const a = entry.clone(); // translated
  const b = entry.clone(); // optimized
  a.mem.write8(SUBSTATE_TIMER, timerValue); // identical poke both sides
  b.mem.write8(SUBSTATE_TIMER, timerValue);
  const cyc0a = a.cycles;
  const cyc0b = b.cycles;
  const retA = translated_0018(a);
  const retB = optimized_0018(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcA: a.pc,
    pcB: b.pc,
    retA,
    retB,
    cycA: a.cycles - cyc0a,
    cycB: b.cycles - cyc0b,
  };
}

test("BRANCH (expiry): counter -> 0 returns true, EQUAL (RAM+regs+SP+pc), per-instruction total == 32 t", () => {
  const r = runBranch(captureEntry(), 1); // dec 1 -> 0 -> Z set -> expiry

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)} (${r.ram.a} vs ${r.ram.b})` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.equal(r.pcA, r.pcB, "pc mismatch on expiry branch");
  assert.equal(r.retB, true, "expiry branch must return true (control comes back)");
  assert.equal(r.retA, r.retB, "boolean return must match oracle on expiry branch");
  assert.equal(r.cycB, r.cycA, `expiry total ${r.cycB} != oracle ${r.cycA}`);
  assert.equal(r.cycB, 32, `expiry branch total must be 32 t, got ${r.cycB}`);
  console.log(`  BRANCH/expiry: EQUAL, return true, cycle total ${r.cycB} t == oracle ${r.cycA} t`);
});

test("BRANCH (skip): counter -> non-zero returns false + unwinds SP, EQUAL, per-instruction total == 48 t", () => {
  const r = runBranch(captureEntry(), 5); // dec 5 -> 4 -> Z clear -> skip

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)} (${r.ram.a} vs ${r.ram.b})` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.equal(r.pcA, r.pcB, "pc mismatch on skip branch");
  assert.equal(r.retB, false, "skip branch must return false (caller must return)");
  assert.equal(r.retA, r.retB, "boolean return must match oracle on skip branch");
  assert.equal(r.cycB, r.cycA, `skip total ${r.cycB} != oracle ${r.cycA}`);
  assert.equal(r.cycB, 48, `skip branch total must be 48 t, got ${r.cycB}`);
  console.log(`  BRANCH/skip: EQUAL (incl. SP unwind), return false, cycle total ${r.cycB} t == oracle ${r.cycA} t`);
});

// -- SP + CYCLE TEETH ---------------------------------------------------------

test("TEETH (SP): a wrong-SP twin is CAUGHT in the register file (SP), since RAM + return match", () => {
  // Natural entry is the SKIP branch, whose whole job is the stack unwind. The twin
  // writes the same 0x6009 and returns the same boolean, so ONLY SP diverges.
  const r = unitEquivalence(makeMachine, TARGET, translated_0018, wrongSp_0018, { maxFrames: MAX_FRAMES });

  assert.equal(r.equal, false, "harness FAILED to catch a wrong SP — the SP contract has no teeth");
  assert.equal(r.ram, null, "the wrong-SP twin writes identical RAM; the divergence must be in a register");
  assert.ok(r.regs != null, "a caught SP divergence must name a register");
  assert.equal(r.regs.reg, "sp", `expected the wrong-SP twin to diverge SP, got ${r.regs.reg}`);
  console.log(`  TEETH/SP: caught at register sp (oracle ${r.regs.a} vs twin ${r.regs.b})`);
});

test("TEETH (cycle): a mis-timed twin (+4 t, same state) is CAUGHT by the cycle-total check", () => {
  const entry = captureEntry();
  const good = entry.clone();
  const bad = entry.clone();
  good.mem.write8(SUBSTATE_TIMER, 5); // SKIP branch on both
  bad.mem.write8(SUBSTATE_TIMER, 5);
  const g0 = good.cycles;
  const b0 = bad.cycles;
  optimized_0018(good);
  misTimed_0018(bad);

  // Same observable state -- the mis-timing is invisible to RAM/regs/pc...
  const ram = firstStateDiff(good.dumpState(), bad.dumpState(), (off) => good.stateOffsetToAddr(off));
  const regs = firstRegDiff(good.regs, bad.regs);
  assert.equal(ram, null, "the mis-timed twin should leave RAM identical");
  assert.equal(regs, null, "the mis-timed twin should leave registers identical");
  assert.equal(good.pc, bad.pc, "the mis-timed twin should leave pc identical");
  // ...but the cycle total is 4 t heavier, which the per-branch cycle check catches.
  assert.equal(bad.cycles - b0, (good.cycles - g0) + 4, "the mis-timed twin must be exactly 4 t heavier");
  console.log(`  TEETH/cycle: mis-timed twin caught -- ${bad.cycles - b0} t vs oracle ${good.cycles - g0} t (+4)`);
});
