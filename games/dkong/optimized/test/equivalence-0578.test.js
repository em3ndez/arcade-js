// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for draw_0578 (render a 3-byte BCD counter up a VRAM
 * column). ROM 0x0578-0x0583, then falls through into loop_0583. Like handler_05c6 /
 * entry_0611 it is a MAIN-LOOP routine, reached via dispatchTask -> handler_05c6 ->
 * {tail_05da | draw_056b} -> here. It is also PARAMETERISED: its ROM has two entry
 * points and the translation models the second as `draw_0578(m, enteredAt057C = true)`,
 * which machine.js `m.call` forwards.
 *
 * COLLAPSED (one m.step per basic block) -- so the whole-machine gate is the
 * CONVERGENT one, not strict. draw_0578 is a main-loop LEAF (NMI mask enabled) whose
 * callee loop_0583 is interruptible and data-dependent, so a mistimed NMI can land
 * inside the folded prologue or the downstream loop; the collapse coarsens the pushed
 * PC to a block-exit address and can leave a benign single-frame raster tear -- both
 * of which a strict byte-exact gate false-fails on but the convergent gate LICENSES
 * (docs/06). The convergent gate still catches everything that matters (a wrong cycle
 * total, a wrong memory op, a forked PRNG) as a PERSISTENT divergence.
 *
 * Because the convergent gate wraps its overrides with an arg-FORWARDING invocation
 * counter (`(mm, ...args) => fn(mm, ...args)`, core/equivalence.js) and machine.js
 * `m.call(0x0578, true)` forwards the flag, BOTH ROM entry points are exercised in
 * situ under the whole-machine run -- no local wrapper is needed (the earlier strict
 * gate here open-coded a forwarding comparison only because the OLD shared strict
 * `wholeMachineEquivalence` dropped the extra arg).
 *
 * Jobs:
 *
 *   1. CONVERGENT (whole-machine) -- collapsed optimized draw_0578 CONVERGES against
 *      its translated oracle over the attract run (pixels + persistent non-stack
 *      state). Attract dispatches draw_0578 for real: every B=3 loop_0583 entry (the
 *      score/high-score renders) is reached THROUGH draw_0578 -- tail_05da via the
 *      0x0578 (FALSE) entry, draw_056b via `m.call(0x0578, true)` (the 0x057C TRUE
 *      entry) -- so both paths fire.
 *
 *   2. EQUAL (unit) -- RAM + full register file (incl. F) + pc identical when the
 *      routine is run in isolation from its first captured entry (the FALSE path).
 *
 *   3. TEETH (convergent) -- a cycle-broken twin (Block B's charge 5 t short) forks
 *      the main loop's spin count (0x6019, the PRNG entropy): a PERSISTENT divergence,
 *      CAUGHT. Block B runs on BOTH entry paths (unconditional), so the drop always
 *      fires. (A value-corruption twin is not used at the whole-machine level -- it
 *      would break a game invariant and could hang a long convergent run; that teeth
 *      stays at the fast unit level, job 4.)
 *
 *   4. TEETH (unit) -- a deliberately-broken twin (the first render digit, stored by
 *      the callee sub_0593 at (IX)=0x7641, lands the wrong value) must be CAUGHT and
 *      localised to 0x7641.
 *
 *   5. BRANCH (unit, enteredAt057C = TRUE) -- the TRUE branch proven EQUAL in
 *      isolation (RAM + regs + pc) AND its cycle total shown equal to the oracle's.
 *
 *   6. CYCLE TOTALS (per branch) -- the collapse's load-bearing invariant: each
 *      entry PATH's prologue total is pinned ABSOLUTE (FALSE 38 t, TRUE 24 t) and
 *      shown equal oracle-vs-optimized. A dropped/moved charge is caught here.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { draw_0578 as translated_0578 } from "../../translated/mainloop.js";
import { draw_0578 as optimized_0578 } from "../draw_0578.js";
import { unitEquivalence } from "../harness.js";
import { convergentGate, SCENARIOS } from "./convergent.js";
import { Machine } from "../../machine.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0578;

// The first store on the routine's FALSE path (high-score render, which dispatches
// first) is the first BCD digit, written by sub_0593 to VRAM 0x7641 -- inside the
// compared state dump (video RAM 0x7400-0x77FF).
const BROKEN_ADDR = 0x7641;

/**
 * Deliberately-broken twin: behaviourally the optimized routine EXCEPT the first
 * store to 0x7641 lands a wrong value (the correct digit XOR 0xFF, guaranteed to
 * differ). Intercepting exactly that one write lets the rest of the routine and
 * every subroutine it calls run verbatim -- the representative "wrong value to one
 * of the routine's own output addresses" bug the gate must catch. Args are
 * forwarded so the twin honours enteredAt057C exactly like the real routine.
 */
function broken_0578(m, ...args) {
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
    return optimized_0578(m, ...args);
  } finally {
    m.mem.write8 = realWrite;
  }
}

/**
 * Cycle-broken twin for the CONVERGENT gate: identical memory + registers to the
 * collapsed routine, but Block B's charge is 5 t short (24 -> 19). Block B runs on
 * BOTH entry paths (unconditional), so the drop always fires. A wrong total forks
 * the main loop's spin count (0x6019, the PRNG entropy) -- a PERSISTENT divergence,
 * never a heal. This is the teeth for the collapse's load-bearing invariant
 * (total-cycle preservation); a value-corruption twin would break a game invariant
 * and could hang a long convergent run, so the value teeth stays at the unit level
 * (job 4 above). Args forwarded so it honours enteredAt057C like the real routine.
 */
function cyclebroken_0578(m, enteredAt057C = false) {
  const { regs } = m;
  if (!enteredAt057C) { regs.ix = 0x7641; m.step(0x057c, 14); }
  regs.exDeHl();
  regs.de = 0xffe0;
  regs.bc = 0x0304;
  m.step(0x0583, 19); // DROPPED: the correct charge here is 24 t
  m.call(0x0583);
}

/**
 * Capture the machine state at draw_0578's first entry, delegating to the oracle so
 * the host run proceeds normally -- the same technique the shared unit gate uses,
 * open-coded here only so the TRUE-branch test can seed its own registers.
 */
function captureEntry(rom, maxFrames = 240) {
  let entry = null;
  const snapshot = new Map([[TARGET, (mm, ...args) => {
    if (entry === null) entry = mm.clone();
    return translated_0578(mm, ...args);
  }]]);
  const host = new Machine(rom, { overrides: snapshot });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error("draw_0578 never entered within the window");
  return entry;
}

/**
 * Charge ONLY draw_0578's own prologue (Block A + Block B), NOT the downstream
 * loop_0583. Wrap m.step to accumulate and stub m.call so the fall-into loop does not
 * run -- the prologue's registers are all set before that call and the collapse
 * changed only the prologue's charges. The per-instruction oracle (14+4+10+10 FALSE /
 * 4+10+10 TRUE) and the collapsed rewrite (14+24 / 24) must charge the SAME per-path
 * total; the loop's cycles are identical on both sides (same m.call to the same
 * frozen loop_0583) and are deliberately excluded here.
 */
function prologueCycles(implFn, enteredAt057C) {
  const c = captureEntry(ROM).clone();
  let cyc = 0, stopped = false;
  const realStep = c.step.bind(c);
  c.step = (addr, t) => { if (!stopped) cyc += t; return realStep(addr, t); };
  c.call = () => { stopped = true; }; // stub the fall-into loop_0583: measure prologue only
  implFn(c, enteredAt057C);
  return cyc;
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine): collapsed draw_0578 CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  // draw_0578 is COLLAPSED and INTERRUPTIBLE, so the strict byte-exact gate false-fails on
  // the mistimed-NMI raster tear + the coarse block-exit PC pushed into the dead stack. The
  // convergent gate is the correct license: pixels ground truth, transient state/pixels OK if
  // they reconverge, dead stack excluded, persistent divergence fails. Its arg-forwarding
  // override wrapper exercises BOTH the FALSE (0x0578) and TRUE (0x057C) entry paths in situ.
  const r = convergentGate(new Map([[TARGET, optimized_0578]]), { scenario: SCENARIOS.attract });

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
    `  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x (FALSE + TRUE entry paths); ` +
      `${r.pixDiffFrames} tear frame(s) (max ${r.maxPixels}px, healed), ` +
      `non-stack state persistent = ${r.statePersistent.length}`,
  );
});

test("EQUAL (unit): idiomatic optimized draw_0578 matches translated in RAM + registers", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_0578, optimized_0578);

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical (FALSE-path entry)");
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  // The convergent gate tolerates transient tears but MUST catch a real (non-healing) error.
  // The collapse's load-bearing invariant is total-cycle preservation; a short charge shifts
  // the spin count 0x6019 (PRNG entropy), forking the RANDOM stream permanently.
  const r = convergentGate(new Map([[TARGET, cyclebroken_0578]]), { scenario: SCENARIOS.attract });

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

test("TEETH (unit): a wrong render store is CAUGHT and names 0x7641", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_0578, broken_0578);

  assert.equal(r.equal, false, "harness FAILED to catch a wrong store — it is worthless");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  assert.equal(
    r.ram.addr,
    BROKEN_ADDR,
    `expected first diff at the broken address 0x${BROKEN_ADDR.toString(16)}, got 0x${r.ram.addr.toString(16)}`,
  );
  console.log(`  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`);
});

// -- FULL BRANCH COVERAGE (enteredAt057C = TRUE) ------------------------------

test("BRANCH (unit): enteredAt057C=TRUE path proven EQUAL (RAM + regs + pc) with matching cycle total", () => {
  const entry = captureEntry(ROM);

  // Seed a representative TRUE-path entry: draw_056b has already chosen IX (0x7781,
  // P1 column) and DE points at the P1 score MSB. Set IDENTICALLY on both clones.
  const a = entry.clone(); // oracle
  const b = entry.clone(); // optimized
  for (const c of [a, b]) { c.regs.ix = 0x7781; c.regs.de = 0x60b4; }

  const ca = a.cycles;
  const cb = b.cycles;
  translated_0578(a, true);
  optimized_0578(b, true);

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  const regs = firstRegDiff(a.regs, b.regs);
  assert.equal(ram, null, ram ? `RAM diff at 0x${ram.addr.toString(16)}` : "");
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(a.pc, b.pc, "pc must match on the TRUE branch");

  // Cycle-total teeth: the collapse preserves the per-path total, so the optimized
  // grand total (Block B folded to 24 t + the deterministic loop_0583 it m.calls)
  // must equal the oracle's per-instruction grand total. A wrong branch total is
  // caught here.
  const oracleCycles = a.cycles - ca;
  const optCycles = b.cycles - cb;
  assert.equal(optCycles, oracleCycles, `TRUE-branch cycle total ${optCycles} != oracle ${oracleCycles}`);
  console.log(`  BRANCH/unit(TRUE): RAM + regs + pc identical; cycle total ${optCycles} == oracle ${oracleCycles}`);
});

// -- CYCLE TOTALS (the collapse's load-bearing invariant) ---------------------

test("CYCLE TOTALS: each entry PATH's prologue folds to the oracle's exact total (FALSE 38 t, TRUE 24 t)", () => {
  // FALSE (0x0578): Block A `ld ix` 14 t + Block B `ex/ld de/ld bc` 24 t = 38 t.
  // TRUE  (0x057C): Block B only = 24 t. Oracle distributes these per-instruction
  // (14+4+10+10 / 4+10+10); the collapse folds Block B to one m.step -- same totals.
  const oFalse = prologueCycles(translated_0578, false);
  const pFalse = prologueCycles(optimized_0578, false);
  const oTrue = prologueCycles(translated_0578, true);
  const pTrue = prologueCycles(optimized_0578, true);

  assert.equal(oFalse, 38, `oracle FALSE prologue should be 38 t, got ${oFalse}`);
  assert.equal(oTrue, 24, `oracle TRUE prologue should be 24 t, got ${oTrue}`);
  assert.equal(pFalse, oFalse, `optimized FALSE prologue ${pFalse} != oracle ${oFalse}`);
  assert.equal(pTrue, oTrue, `optimized TRUE prologue ${pTrue} != oracle ${oTrue}`);
  console.log(`  CYCLE TOTALS: FALSE ${pFalse} t == oracle ${oFalse} t; TRUE ${pTrue} t == oracle ${oTrue} t`);
});
