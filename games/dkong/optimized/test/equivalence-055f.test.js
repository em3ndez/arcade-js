// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for sub_055f (select the current player's 3-byte BCD
 * score base into DE: 0x600D==0 -> P1_SCORE 0x60B2, else P2_SCORE 0x60B5). It is
 * a LEAF reached ONLY by m.call(0x055f) from entry_051c (task-table entry 0), at
 * that routine's 0x051E and 0x0550 call sites.
 *
 * WHY THIS ROUTINE NEEDS MORE THAN THE 0611 TEMPLATE (and follows 051c instead).
 * entry_051c opens with an ENABLE GUARD (rst 0x08 / sub_0008): during ATTRACT it
 * discards its own return and does nothing -- so it never reaches `call 0x055f`.
 * The input-less whole-machine harness only ever runs in attract, so sub_055f is
 * NEVER naturally entered: a plain wholeMachineEquivalence override would report
 * invocations==0 (a vacuous EQUAL), and the standard unitEquivalence would throw
 * "never entered". Both the whole-machine gate and the unit entry must therefore
 * be DRIVEN past the guard, exactly as equivalence-051c.test.js does.
 *
 * The six tests, split by what each gate can reach:
 *
 *   1. EQUAL (whole-machine, CONVERGENT, ATTRACT poked clear) -- pokes ATTRACT bit0
 *      clear on BOTH sides (identically, so the comparison stays fair) so entry_051c's
 *      natural frame-~1137 task runs the REAL scoring path and m.call's sub_055f
 *      under live NMI timing. Gated CONVERGENT unconditionally (not strict), per the
 *      collapse-sweep's blanket rule: sub_055f's sole caller runs with the NMI mask
 *      ENABLED, so "passes strict in this scenario" would only be a property of the
 *      tested trajectory, not proof of atomicity. Asserts the override actually
 *      fired and the collapsed sub_055f CONVERGES with the oracle (pixels +
 *      persistent non-stack state) over the whole trace.
 *
 *   2. EQUAL (unit, BOTH branches) -- attract never credits a game, so a real
 *      sub_055f entry is SYNTHESISED from a captured live machine: push the call's
 *      return address, set CURRENT_PLAYER, and diff translated vs optimized (RAM +
 *      all registers incl. F + pc). Runs sel=0 (ret-z -> P1_SCORE) AND sel=1
 *      (fall-through -> P2_SCORE): full branch coverage, one assertion per branch,
 *      each first asserting the oracle really reaches that branch's DE.
 *
 *   3. TEETH (unit, real entry) -- a broken sub_055f that returns the WRONG DE (its
 *      only output is the register, not a store) is CAUGHT as a REGISTER diff at
 *      `e` (the low byte of DE, 0xB2 vs 0xB5). sub_055f writes no RAM, so the unit
 *      teeth land on the register file -- which is precisely the contract the unit
 *      gate guards.
 *
 *   4. TEETH (convergent, poked) -- the collapse's load-bearing invariant is each
 *      branch's folded total; a CYCLE-DROP twin (the shared pre-branch block
 *      shortened by 5t, so it bites whichever branch fires) forks the main loop's
 *      spin count (0x6019, the PRNG entropy) into a PERSISTENT divergence, which the
 *      convergent gate must catch (never a value-corruption twin over the long run
 *      -- it can hang the game).
 *
 * CYCLE DECISION. sub_055f is COLLAPSED to one m.step per basic block: its sole
 * caller entry_051c is a main-loop routine (NMI mask enabled), so the vblank NMI
 * can land inside this leaf -- theoretically interruptible, hence the convergent
 * (not strict) gate for the whole-machine job. See optimized/sub_055f.js for the
 * fold and the exact branch totals.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_055f as translated_055f, entry_051c as translated_051c } from "../../translated/mainloop.js";
import { sub_055f as optimized_055f } from "../sub_055f.js";
import { Machine } from "../../machine.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { convergentGate } from "./convergent.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const CALLER = 0x051c; // entry_051c: the sole caller (task-table entry 0)
const TARGET = 0x055f; // sub_055f
const CAP_FRAMES = 1160; // entry_051c first dispatches at frame ~1137

// -- RAM this routine and its caller touch ------------------------------------
const ATTRACT = 0x6007; // bit0 = the enable guard entry_051c's rst 0x08 tests
const CURRENT_PLAYER = 0x600d; // 0 -> P1_SCORE base, else P2_SCORE base
const P1_SCORE = 0x60b2; // returned in DE when CURRENT_PLAYER == 0
const P2_SCORE = 0x60b5; // returned in DE when CURRENT_PLAYER != 0
const RET_ADDR = 0x0521; // entry_051c's return address for its 0x051E `call 0x055f`

// -- shared helpers -----------------------------------------------------------

/**
 * Capture the machine at the first natural entry_051c dispatch (the guard-skip
 * entry in attract), snapshotting a pristine clone. The host run continues via
 * the translated oracle so it reaches a clean stop. We capture the CALLER (which
 * IS reachable) because sub_055f is never entered in attract.
 */
function captureCallerEntry(maxFrames = CAP_FRAMES) {
  const host = new Machine(ROM);
  let entry = null;
  host.overrides = new Map([[CALLER, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_051c(mm);
  }]]);
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${CALLER.toString(16)} never dispatched in ${maxFrames} frames`);
  return entry;
}

/**
 * Synthesise a sub_055f entry from a captured live machine: select the player,
 * then push the return address entry_051c pushes before `call 0x055f`. sub_055f
 * reads only CURRENT_PLAYER and needs a valid stack for its `ret`, so this is a
 * faithful entry for either branch.
 */
function makeEntry(base, sel) {
  const s = base.clone();
  s.mem.write8(CURRENT_PLAYER, sel);
  s.push16(RET_ADDR); // the `call 0x055f` return address (entry_051c @ 0x051E)
  return s;
}

/** Run translated vs optimized on independent clones of `entry`; return the diffs. */
function unitDiff(entry, optFn = optimized_055f) {
  const a = entry.clone();
  const b = entry.clone();
  translated_055f(a);
  optFn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o)),
    regs: firstRegDiff(a.regs, b.regs),
    pc: a.pc === b.pc ? null : { a: a.pc, b: b.pc },
    de: b.regs.de,
    oracleDe: a.regs.de,
  };
}

/**
 * Broken twin: behaviourally optimized_055f, EXCEPT the returned DE is corrupted
 * (XOR 0x0007 swaps the two valid bases 0x60B2 <-> 0x60B5, so it is always wrong
 * whichever branch ran). sub_055f writes no RAM, so its representative bug is a
 * WRONG RESULT in DE -- caught as a register diff (unit) and, once the caller
 * bases its score writes on it, as downstream state drift (whole-machine).
 */
function broken_055f(m) {
  optimized_055f(m);
  m.regs.de = (m.regs.de ^ 0x0007) & 0xffff;
}

/**
 * Cycle-broken twin for the CONVERGENT gate: identical to the collapsed routine
 * EXCEPT the shared pre-branch block's folded charge is 5t short (22 instead of
 * 27), so it bites whichever branch fires. A wrong total shifts the main loop's
 * spin count (0x6019, the PRNG entropy), forking the RANDOM stream permanently --
 * a PERSISTENT non-stack divergence, never a heal.
 */
function cyclebroken_055f(m) {
  const { regs, mem } = m;
  regs.de = P1_SCORE;
  regs.a = mem.read8(CURRENT_PLAYER);
  regs.and(regs.a);
  m.step(0x0566, 22); // DROPPED: the correct total is 27 t
  if (regs.fZ) {
    m.ret(11);
    return;
  }
  regs.de = P2_SCORE;
  m.step(0x056a, 15);
  m.ret();
}

// A CUSTOM convergentGate scenario: the same ATTRACT-bit0-clear poke the hand-rolled
// pokedRun used (sub_055f is unreachable in plain attract without it -- entry_051c's
// enable guard aborts before `call 0x055f`).
const CUSTOM_SCENARIO = { frames: 1200, pokes: [{ addr: ATTRACT, val: 0x00, frame: 1100, dur: 100 }] };

// -- 1. EQUAL (whole-machine, CONVERGENT, ATTRACT poked clear) ----------------

test("CONVERGENT (whole-machine): collapsed sub_055f CONVERGES vs translated under an ATTRACT poke (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_055f]]), { scenario: CUSTOM_SCENARIO });

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
    `  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x (real path via ATTRACT poke); ` +
      `${r.pixDiffFrames} tear frame(s) (max ${r.maxPixels}px, healed), ` +
      `non-stack state persistent = ${r.statePersistent.length}`,
  );
});

// -- 2. EQUAL (unit, BOTH branches) -------------------------------------------

test("EQUAL (unit): optimized sub_055f matches the oracle on BOTH branches (RAM + regs + pc)", () => {
  const base = captureCallerEntry();

  // Branch A: CURRENT_PLAYER == 0 -> ret z -> DE = P1_SCORE.
  {
    const entry = makeEntry(base, 0x00);
    const d = unitDiff(entry);
    assert.equal(d.oracleDe, P1_SCORE, `sel=0 must reach the P1 branch (oracle DE=0x${d.oracleDe.toString(16)})`);
    assert.equal(d.ram, null, d.ram ? `RAM diff at 0x${d.ram.addr.toString(16)} (${d.ram.a} vs ${d.ram.b})` : "");
    assert.equal(d.regs, null, d.regs ? `reg diff at ${d.regs.reg} (${d.regs.a} vs ${d.regs.b})` : "");
    assert.equal(d.pc, null, "pc must match (P1 branch)");
  }

  // Branch B: CURRENT_PLAYER != 0 -> fall through -> DE = P2_SCORE.
  {
    const entry = makeEntry(base, 0x01);
    const d = unitDiff(entry);
    assert.equal(d.oracleDe, P2_SCORE, `sel=1 must reach the P2 branch (oracle DE=0x${d.oracleDe.toString(16)})`);
    assert.equal(d.ram, null, d.ram ? `RAM diff at 0x${d.ram.addr.toString(16)} (${d.ram.a} vs ${d.ram.b})` : "");
    assert.equal(d.regs, null, d.regs ? `reg diff at ${d.regs.reg} (${d.regs.a} vs ${d.regs.b})` : "");
    assert.equal(d.pc, null, "pc must match (P2 branch)");
  }

  console.log("  EQUAL/unit: both branches (P1 ret-z + P2 fall-through) — RAM + all registers (incl. F) + pc identical");
});

// -- 3. TEETH (convergent, poked) ----------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_055f]]), { scenario: CUSTOM_SCENARIO });

  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.pass, false, "convergent gate FAILED to catch a wrong cycle total -- it is worthless");
  assert.ok(
    r.statePersistent.length > 0 || r.pixelPersistent,
    "a caught divergence must be persistent (non-stack state or pixels)",
  );
  console.log(
    `  TEETH/convergent: caught -- persistent non-stack addrs ${r.statePersistent.length}, ` +
      `pixelPersistent ${r.pixelPersistent}`,
  );
});

// -- 4. TEETH (unit, real entry) ----------------------------------------------

test("TEETH (unit): a wrong DE result is CAUGHT as a register diff at `e`", () => {
  const entry = makeEntry(captureCallerEntry(), 0x00); // sel=0 -> oracle DE=0x60B2
  const d = unitDiff(entry, broken_055f);

  assert.equal(d.ram, null, "sub_055f writes no RAM, so the RAM dump must stay identical");
  assert.ok(d.regs != null, "harness FAILED to catch a wrong DE — it is worthless");
  assert.equal(
    d.regs.reg,
    "e",
    `expected the wrong result to diverge at register e (DE low byte), got ${d.regs.reg}`,
  );
  assert.equal(d.regs.a, P1_SCORE & 0xff, "oracle e must be 0xB2 (P1_SCORE low byte)");
  assert.equal(d.regs.b, P2_SCORE & 0xff, "broken e must be 0xB5 (corrupted to P2_SCORE low byte)");
  console.log(`  TEETH/unit: caught at register ${d.regs.reg} (oracle 0x${d.regs.a.toString(16)} vs broken 0x${d.regs.b.toString(16)})`);
});
