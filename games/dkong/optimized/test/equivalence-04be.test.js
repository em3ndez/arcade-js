// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for loc_04be (the (0x6227)==4 blink block of the
 * intro/colour-cycle tail loc_0486, ROM 0x04BE). It lays two colour-RAM columns
 * via sub_0514, then routes a per-frame colour blink three ways on bit 6 of the
 * frame counter C and on which half of the screen Mario is on (MARIO_X vs 0x80).
 * Its ONE caller is loc_0486 (`jp z,0x04be`), reached via loc_197a -> entry_03fb
 * -> the loc_0413 colour tree, the per-frame in-game cascade — so it needs a
 * credited game AND BOARD (0x6227)==4 to run.
 *
 * loc_04be is COLD/latent: a driven board-1 game NEVER sees BOARD==4, so loc_0486
 * never jumps to 0x04be on its own. To exercise it, an identical-both-sides poke
 * holds 0x6227=4 from frame 1040 (after the board is up and loc_197a is cascading);
 * loc_04be then dispatches every frame from ~f1041 (261x in a 1300-frame window),
 * and the run stays healthy (reaches the vblank spin every frame). The poke is
 * deterministic (oracle-vs-oracle under it is byte-identical over 1300 frames), so
 * the whole-machine gate is meaningful, not vacuous.
 *
 * Seven jobs:
 *
 *   1. CONVERGENT (whole-machine) — idiomatic optimized loc_04be converges against
 *      its translated oracle (pixels + non-stack state) under a coin+start+BOARD=4
 *      scenario, override firing 261x (asserted >= 1). loc_04be's m.step charges are
 *      COLLAPSED to one per basic block (see optimized/loc_04be.js) — licensed by the
 *      CONVERGENT gate rather than the strict whole-machine gate, per the
 *      collapse-sweep rule (strict-vs-convergent is a property of the tested
 *      scenario, not a per-routine judgment call).
 *
 *   2. EQUAL (unit) — translated vs optimized leave identical RAM + all registers
 *      (incl. F) + pc from the captured first-entry state (frame ~1041; C's bit6
 *      clear, MARIO_X=0x3f — the natural branch A).
 *
 *   3+4+5. BRANCH COVERAGE — loc_04be's two data-dependent guards (`bit 6,c` then,
 *      on bit6 set, `cp 0x80` on MARIO_X) fan out to THREE exits. The driven run
 *      only reaches branch A (bit6 always clear here). Each arm is proven EQUAL on
 *      clones of the captured entry with C / MARIO_X poked identically on BOTH sides,
 *      asserting RAM + regs + pc AND the branch's CYCLE TOTAL (kept per-instruction,
 *      so a wrong charge on a cold arm has explicit teeth), plus a colour-RAM /
 *      blink-bit SIGNATURE that proves the intended path actually ran:
 *        - A  bit6 clear (c=0x00, X=0x3f):  -> loc_0509 -> loc_04e1 (blink ON)   448 t
 *             sig: 0x7623=0x10 (no 3rd fill), 0x7583=0x0d, 0x6905 bit7 SET
 *        - B  bit6 set,  X>=0x80 (c=0x40,X=0xc0): -> loc_04f1 -> loc_04f9 (OFF)  637 t
 *             sig: 0x7583=0xef (loc_04f1's fill), 0x6905 bit7 CLEAR
 *        - C  bit6 set,  X<0x80  (c=0x40,X=0x3f): -> 3rd fill + loc_04e1 (ON)    637 t
 *             sig: 0x7623=0xdf (the 3rd fill), 0x6905 bit7 SET
 *
 *   6+7. TEETH (convergent + unit) — a deliberately-broken twin whose first
 *      colour-RAM store (0x7623, written on every path via the first sub_0514 fill)
 *      lands the wrong value must be CAUGHT: NOT-EQUAL, naming 0x7623 (unit level).
 *      A CYCLE-DROP twin (Block 1's charge 5 t short) forks the PRNG spin count,
 *      CAUGHT as a PERSISTENT convergent divergence.
 *
 * WHY THE CORE ENGINE + A CUSTOM FACTORY (not harness.js's wrappers). Same reason
 * as entry_03fb / loc_197a: harness.js bakes a makeMachine on `{}` assets that
 * drives NO input, so it never credits a game and never dispatches loc_197a ->
 * ... -> loc_04be. This test calls the SAME core unitEquivalence /
 * wholeMachineEquivalence directly, with a makeMachine factory that attaches an
 * identical coin+start inputTape AND the identical BOARD=4 poke to BOTH sides (the
 * factory is shared, so every input/poke is applied identically to baseline and
 * optimized). A Machine built with no overrides runs the pure oracle.
 *
 * CYCLE FINDING this routine adds: loc_04be is NON-ATOMIC and stays PER-
 * INSTRUCTION, byte-identical to the oracle. Its sole caller loc_0486 sits inside
 * the interruptible loc_197a -> entry_03fb per-frame cascade (NMI mask ENABLED),
 * and loc_04be tail-jumps further interruptible colour-tree routines, so the vblank
 * NMI can land inside it — its internal cycle distribution is observable. Per the
 * ATOMICITY-IS-PER-CALL-PATH rule a leaf reached from an interruptible caller is
 * not atomic, so NO collapse (same decision as entry_03fb / loc_197a / handler_01c3).
 * Each branch's cycle TOTAL is asserted equal on clones anyway.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_04be as translated_04be } from "../../translated/state0.js";
import { loc_04be as optimized_04be } from "../loc_04be.js";
import { Machine } from "../../machine.js";
import {
  unitEquivalence,
  firstStateDiff,
  firstRegDiff,
} from "../../../../core/equivalence.js";
import { convergentGate } from "./convergent.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x04be;
const MAX_FRAMES = 1080; // loc_04be first dispatches at frame ~1041

// Branch selectors: C = loc_0486's frame counter (bit 6 tested), MARIO_X = 0x6203.
const MARIO_X = 0x6203;

// The first colour-RAM store on EVERY path — the first sub_0514 fill's cell 0x7623
// (value 0x10). It sits in the compared video-RAM dump (0x7400-0x77FF) and is
// write-only on this path (nothing reads it back before the routine returns), so a
// corruption there is a clean caught diff. (Branch C overwrites it with 0xdf on the
// 3rd fill; the twin corrupts the FIRST write, which every path performs.)
const BROKEN_ADDR = 0x7623;

// A coin+start tape (identical to entry_03fb's): coin on IN2 bit7 at frame 10,
// start1 on IN2 bit2 at frame 30 — credits and starts a game so the loc_197a ->
// entry_03fb -> loc_0486 cascade runs.
const COIN_START_TAPE = [
  { port: 0x7d00, bits: 0x80, frame: 10, dur: 6 }, // coin  (IN2 bit7)
  { port: 0x7d00, bits: 0x04, frame: 30, dur: 6 }, // start (IN2 bit2)
];

// loc_04be is COLD on board 1; hold BOARD (0x6227)=4 from frame 1040 (identical on
// both sides) so loc_0486's `cp 0x04 / jp z,0x04be` routes into it every frame.
const BOARD_POKE = [{ addr: 0x6227, val: 0x04, frame: 1040, dur: null }];

// The makeMachine factory the core engine drives, extended to attach BOTH the
// coin+start inputTape and the BOARD=4 poke. Called with no argument for the
// baseline (pure oracle) and with the wrapped override map for the optimized side
// — both get the SAME tape and the SAME poke.
function makeMachine(overrides) {
  const m = new Machine(ROM, overrides ? { overrides } : {});
  m.inputTape = COIN_START_TAPE.map((t) => ({ ...t }));
  m.pokes = BOARD_POKE.map((p) => ({ ...p }));
  return m;
}

// Scenario for the CONVERGENT gate (convergentGate loads gfx/proms + enables video
// capture itself): same coin+start tape and BOARD=4 poke as the crafted-entry tests,
// run to 1400 frames -- comfortably past the cutscene's ~f1041.. firing window,
// leaving a long, quiet tail for reconvergence.
const CONVERGENT_SCENARIO_04BE = { frames: 1400, inputs: COIN_START_TAPE, pokes: BOARD_POKE };

/**
 * Deliberately-broken twin: behaviourally optimized_04be EXCEPT the first store to
 * 0x7623 lands a wrong value (the correct byte XOR 0xFF, guaranteed to differ).
 * Intercepting exactly that one write lets the rest of the routine and every
 * subroutine it calls run verbatim — the representative "wrong value to an address
 * on the routine's path" bug the gate must catch.
 */
function broken_04be(m) {
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
    return optimized_04be(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

/**
 * Cycle-broken twin for the CONVERGENT gate: identical to the collapsed routine
 * except Block 1's charge (ld a,0x10 + ld hl,0x7623 + sub_0514's call charge, hit on
 * EVERY invocation) is 5 t short. A wrong total shifts the main loop's spin count --
 * the PRNG entropy at 0x6019 -- so the RANDOM stream FORKS: a PERSISTENT divergence,
 * never a heal.
 */
function cyclebroken_04be(m) {
  const { regs, mem } = m;

  regs.a = 0x10;
  regs.hl = 0x7623;
  m.push16(0x04c6);
  m.step(0x0514, 34 - 5); // DROPPED: the correct charge here is 34 t
  m.call(0x0514);

  regs.hl = 0x7583;
  m.push16(0x04cc);
  m.step(0x0514, 27);
  m.call(0x0514);

  regs.bit(6, regs.c);
  m.step(0x04ce, 8);
  if (regs.fZ) {
    m.step(0x0509, 10);
    return m.call(0x0509);
  }

  regs.a = mem.read8(MARIO_X);
  regs.cp(0x80);
  m.step(0x04d6, 30);
  if (regs.fNC) {
    m.step(0x04f1, 10);
    return m.call(0x04f1);
  }

  regs.a = 0xdf;
  regs.hl = 0x7623;
  m.push16(0x04e1);
  m.step(0x0514, 44);
  m.call(0x0514);
  return m.call(0x04e1);
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine): collapsed loc_04be CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_04be]]), { scenario: CONVERGENT_SCENARIO_04BE });

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
    `  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x (per-frame via loc_0486, ~f1041.., BOARD=4 poked); ` +
      `${r.pixDiffFrames} tear frame(s) (max ${r.maxPixels}px, healed), ` +
      `non-stack state persistent = ${r.statePersistent.length}`,
  );
});

test("EQUAL (unit): idiomatic optimized loc_04be matches translated in RAM + registers", () => {
  const r = unitEquivalence(makeMachine, TARGET, translated_04be, optimized_04be, { maxFrames: MAX_FRAMES });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F, A, SP) + pc identical (first entry: frame ~1041, branch A)");
});

// -- BRANCH COVERAGE ----------------------------------------------------------

// Capture the pristine machine at loc_04be's FIRST dispatch (frame ~1041), via the
// same construction-time snapshot the core unit gate uses.
function captureEntry() {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_04be(mm); // let the host run proceed to a clean stop
  }]]);
  const host = makeMachine(snap);
  host.runFrames(MAX_FRAMES);
  if (entry === null) throw new Error(`loc_04be never dispatched within ${MAX_FRAMES} frames`);
  return entry;
}

// Run oracle vs optimized on two clones of `entry`, with C and MARIO_X poked
// identically on both sides, and diff RAM + regs + pc + cycle total. Returns
// diagnostics incl. the post-run colour-RAM / blink signature.
function diffBranch(entry, c, x) {
  const a = entry.clone(); // translated
  const b = entry.clone(); // optimized
  for (const cl of [a, b]) {
    cl.regs.c = c;
    cl.mem.write8(MARIO_X, x);
  }
  const cA0 = a.cycles, cB0 = b.cycles;
  translated_04be(a);
  optimized_04be(b);
  const dA = a.cycles - cA0, dB = b.cycles - cB0;

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  const regs = firstRegDiff(a.regs, b.regs);
  return {
    ram,
    regs,
    pcEq: a.pc === b.pc,
    dA,
    dB,
    v7623: a.mem.read8(0x7623),
    v7583: a.mem.read8(0x7583),
    blink6905: (a.mem.read8(0x6905) >> 7) & 1,
  };
}

test("BRANCH A (unit): bit6 clear -> loc_0509 -> loc_04e1 (blink ON) EQUAL (RAM+regs+pc+cycles)", () => {
  const r = diffBranch(captureEntry(), 0x00, 0x3f);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)} (${r.ram.a} vs ${r.ram.b})` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.ok(r.pcEq, "pc must match");
  assert.equal(r.dA, r.dB, `cycle-total mismatch (translated ${r.dA} vs optimized ${r.dB})`);
  // Signature: no 3rd fill (0x7623 stays the first fill's 0x10), second fill wrote
  // 0x0d (not loc_04f1's 0xef), blink ON — i.e. loc_0509 -> loc_04e1.
  assert.equal(r.v7623, 0x10, "branch A must NOT do the 3rd fill (0x7623 stays 0x10)");
  assert.equal(r.blink6905, 1, "branch A must set the blink bit (loc_04e1, ON)");
  console.log(`  BRANCH/A: bit6-clear arm EQUAL, 0x7623=0x10, 0x7583=0x${r.v7583.toString(16)}, blink ON, cycles match (${r.dA} t)`);
});

test("BRANCH B (unit): bit6 set, X>=0x80 -> loc_04f1 -> loc_04f9 (blink OFF) EQUAL (RAM+regs+pc+cycles)", () => {
  const r = diffBranch(captureEntry(), 0x40, 0xc0);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)} (${r.ram.a} vs ${r.ram.b})` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.ok(r.pcEq, "pc must match");
  assert.equal(r.dA, r.dB, `cycle-total mismatch (translated ${r.dA} vs optimized ${r.dB})`);
  // Signature: loc_04f1 filled 0x7583 with 0xef, and loc_04f9 cleared the blink bit.
  assert.equal(r.v7583, 0xef, "branch B must run loc_04f1's fill (0x7583=0xef)");
  assert.equal(r.blink6905, 0, "branch B must clear the blink bit (loc_04f9, OFF)");
  console.log(`  BRANCH/B: bit6-set X>=0x80 arm EQUAL, 0x7583=0xef, blink OFF, cycles match (${r.dA} t)`);
});

test("BRANCH C (unit): bit6 set, X<0x80 -> 3rd fill + loc_04e1 (blink ON) EQUAL (RAM+regs+pc+cycles)", () => {
  const r = diffBranch(captureEntry(), 0x40, 0x3f);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)} (${r.ram.a} vs ${r.ram.b})` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.ok(r.pcEq, "pc must match");
  assert.equal(r.dA, r.dB, `cycle-total mismatch (translated ${r.dA} vs optimized ${r.dB})`);
  // Signature: the 3rd fill overwrote 0x7623 with 0xdf, and loc_04e1 set the blink bit.
  assert.equal(r.v7623, 0xdf, "branch C must do the 3rd fill (0x7623=0xdf)");
  assert.equal(r.blink6905, 1, "branch C must set the blink bit (loc_04e1, ON)");
  console.log(`  BRANCH/C: bit6-set X<0x80 arm EQUAL, 0x7623=0xdf, blink ON, cycles match (${r.dA} t)`);
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG — a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_04be]]), { scenario: CONVERGENT_SCENARIO_04BE });

  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.pass, false, "convergent gate FAILED to catch a wrong cycle total — it is worthless");
  assert.ok(
    r.statePersistent.length > 0 || r.pixelPersistent,
    "a caught divergence must be persistent (non-stack state or pixels)",
  );
  console.log(
    `  TEETH/convergent: caught — persistent non-stack addrs ${r.statePersistent.length}` +
      `${r.statePersistent.length ? " (" + r.statePersistent.slice(0, 4).map((s) => "0x" + s.addr.toString(16)).join(",") + ")" : ""}, ` +
      `pixelPersistent ${r.pixelPersistent}`,
  );
});

test("TEETH (unit): a wrong colour-RAM store is CAUGHT and names 0x7623", () => {
  const r = unitEquivalence(makeMachine, TARGET, translated_04be, broken_04be, { maxFrames: MAX_FRAMES });

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
