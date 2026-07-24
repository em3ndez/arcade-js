// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for loc_04ac (ROM 0x04AC-0x04BD: the SHARED colour-
 * byte store + 3-way "blink" exit of the attract/in-game colour-cycle tree). It
 * `ld (0x6905),a`, then routes on the attract frame counter in C: bit6 clear ->
 * `ret z` (EXIT-1); else low-3-bits nonzero -> `ret nz` (EXIT-2); else flip colour
 * bits 0,1 (`xor 0x03`) and re-store (EXIT-3). Reached only through `m.call(0x04ac)`
 * from three sites in the tree (loc_04a3 falls in, loc_04e1/loc_04f9 jp back), all
 * under loc_197a's per-frame in-game cascade, so — like its parent entry_03fb — it
 * needs a credited game to run and is driven with a coin+start inputTape.
 *
 * Seven jobs:
 *
 *   1. CONVERGENT (whole-machine) — idiomatic optimized loc_04ac (optimized/
 *      loc_04ac.js) converges against its translated oracle (pixels + non-stack
 *      state) under a coin+start scenario. loc_04ac dispatches once per frame of
 *      board 1 via loc_197a->entry_03fb->...->loc_04a3: first at frame ~1033, then
 *      per frame. The override must actually fire (asserted) or CONVERGENT would be
 *      vacuous. loc_04ac's m.step charges are COLLAPSED to one per basic block (see
 *      optimized/loc_04ac.js) — licensed by the CONVERGENT gate rather than the
 *      strict whole-machine gate, per the collapse-sweep rule (strict-vs-convergent
 *      is a property of the tested scenario, not a per-routine judgment call).
 *
 *   2. EQUAL (unit) — translated vs optimized leave identical RAM + registers
 *      (incl. F) + pc from the captured entry state (first dispatch, frame ~1033).
 *
 *   3+4+5. BRANCH COVERAGE — loc_04ac's exit is decided by the frame counter C
 *      (`bit 6,c` then `and 0x07`). Each of the three exits is proven EQUAL on
 *      clones of the captured entry with C poked identically on BOTH sides (an
 *      identical-both-sides poke), asserting RAM + regs + pc AND the branch's
 *      CYCLE TOTAL (kept per-instruction, so a wrong charge on any arm has explicit
 *      teeth):
 *        - EXIT-1  C = 0x00 (bit6 clear):            `ret z`, single store   (32 t)
 *        - EXIT-2  C = 0x41 (bit6 set, low3 = 1):    `ret nz`, single store  (52 t)
 *        - EXIT-3  C = 0x40 (bit6 set, low3 = 0):    flip 0,1 + re-store      (80 t)
 *      The EXIT-3 arm's signature is that 0x6905 changes to entryA^0x03; EXIT-1/2
 *      leave 0x6905 == entryA (the store writes back what loc_04a3 just read).
 *
 *   6+7. TEETH (convergent + unit) — a deliberately-broken twin whose store(s) to
 *      0x6905 land the wrong value must be CAUGHT: NOT-EQUAL, naming 0x6905 (unit
 *      level; loc_04ac can write 0x6905 twice on EXIT-3 and never re-reads it, so
 *      the broken twin corrupts EVERY 0x6905 write). A CYCLE-DROP twin (Block 1's
 *      charge 5 t short) forks the PRNG spin count, CAUGHT as a PERSISTENT
 *      convergent divergence.
 *
 * WHY THE CORE ENGINE + A CUSTOM FACTORY (not harness.js's wrappers). Same reason
 * as entry_03fb/loc_197a: harness.js bakes a makeMachine on `{}` assets that drives
 * NO input, so it never credits a game and never dispatches loc_197a -> never
 * loc_04ac. This test calls the SAME core unitEquivalence / wholeMachineEquivalence
 * directly, with a makeMachine factory that attaches an identical coin+start
 * inputTape to BOTH sides (the factory is shared, so any input/poke is applied
 * identically to baseline and optimized). A Machine built with no overrides runs
 * the pure oracle (the manifest's optimized routines are NOT auto-applied).
 *
 * CYCLE FINDING this routine adds: loc_04ac is NON-ATOMIC and stays PER-INSTRUCTION,
 * byte-identical to the oracle. It is a leaf, but ATOMICITY IS PER-CALL-PATH — all
 * three callers sit under the interruptible loc_197a cascade (NMI mask ENABLED), so
 * the vblank NMI can land inside its 11-instruction body and its internal cycle
 * distribution is observable. No collapse; every oracle m.step charge is retained
 * (same decision as its parent entry_03fb and loc_197a). Each branch's cycle TOTAL
 * is asserted on clones anyway.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_04ac as translated_04ac } from "../../translated/state0.js";
import { loc_04ac as optimized_04ac } from "../loc_04ac.js";
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

const TARGET = 0x04ac;
const MAX_FRAMES = 1080; // loc_04ac first dispatches at frame ~1033

// The routine's one output address: `ld (0x6905),a`. A byte inside SPRITE_BUFFER
// (0x6900), in the compared work-RAM dump (0x6000-0x6BFF). loc_04ac never re-reads
// it, so a corrupted store is a clean caught diff.
const OUT_ADDR = 0x6905;

// A coin+start tape (identical to loc_197a's / entry_03fb's): coin on IN2 bit7 at
// frame 10, start1 on IN2 bit2 at frame 30. Credits + starts a game so the in-game
// cascade loc_197a -> entry_03fb -> ... -> loc_04ac runs.
const COIN_START_TAPE = [
  { port: 0x7d00, bits: 0x80, frame: 10, dur: 6 }, // coin  (IN2 bit7)
  { port: 0x7d00, bits: 0x04, frame: 30, dur: 6 }, // start (IN2 bit2)
];

// The makeMachine factory the core engine drives, extended to attach the coin+start
// inputTape. Called with no argument for the baseline (pure oracle) and with the
// wrapped override map for the optimized side — both get the SAME tape.
function makeMachine(overrides) {
  const m = new Machine(ROM, overrides ? { overrides } : {});
  m.inputTape = COIN_START_TAPE.map((t) => ({ ...t }));
  return m;
}

// Scenario for the CONVERGENT gate (convergentGate loads gfx/proms + enables video
// capture itself): same coin+start tape as the crafted-entry tests, run to 1400
// frames -- comfortably past the cutscene's ~1033..1230 firing window, leaving a
// long, quiet tail (170+ frames) for reconvergence.
const CONVERGENT_SCENARIO_04AC = { frames: 1400, inputs: COIN_START_TAPE };

/**
 * Deliberately-broken twin: behaviourally optimized_04ac EXCEPT EVERY store to
 * 0x6905 lands a wrong value (the correct byte XOR 0xFF, guaranteed to differ).
 * loc_04ac writes 0x6905 twice on the EXIT-3 (blink) branch and never re-reads it,
 * so breaking only the first store would be erased by the second, correct store —
 * breaking both guarantees the final value is wrong on ALL three exits.
 */
function broken_04ac(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  m.mem.write8 = (addr, value, busOffset) => {
    if (addr === OUT_ADDR) return realWrite(addr, value ^ 0xff, busOffset);
    return realWrite(addr, value, busOffset);
  };
  try {
    return optimized_04ac(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

/**
 * Cycle-broken twin for the CONVERGENT gate: identical to the collapsed routine
 * except Block 1's charge (ld (0x6905),a + bit 6,c, hit on EVERY invocation) is
 * 5 t short. A wrong total shifts the main loop's spin count -- the PRNG entropy at
 * 0x6019 -- so the RANDOM stream FORKS: a PERSISTENT divergence, never a heal.
 */
function cyclebroken_04ac(m) {
  const { regs, mem } = m;

  mem.write8(0x6905, regs.a);
  regs.bit(6, regs.c);
  m.step(0x04b1, 21 - 5); // DROPPED: the correct charge here is 21 t
  if (regs.fZ) { m.ret(11); return; }

  regs.b = regs.a;
  regs.a = regs.c;
  regs.and(0x07);
  m.step(0x04b6, 20);
  if (regs.fNZ) { m.ret(11); return; }

  regs.a = regs.b;
  regs.xor(0x03);
  mem.write8(0x6905, regs.a);
  m.step(0x04bd, 29);
  m.ret(10);
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine): collapsed loc_04ac CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_04ac]]), { scenario: CONVERGENT_SCENARIO_04AC });

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
    `  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x (per-frame via loc_197a, ~f1033..f1230); ` +
      `${r.pixDiffFrames} tear frame(s) (max ${r.maxPixels}px, healed), ` +
      `non-stack state persistent = ${r.statePersistent.length}`,
  );
});

test("EQUAL (unit): idiomatic optimized loc_04ac matches translated in RAM + registers", () => {
  const r = unitEquivalence(makeMachine, TARGET, translated_04ac, optimized_04ac, { maxFrames: MAX_FRAMES });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F, A, B) + pc identical (first entry: frame ~1033)");
});

// -- BRANCH COVERAGE ----------------------------------------------------------

// Capture the pristine machine at loc_04ac's FIRST dispatch (frame ~1033), via the
// same construction-time snapshot the core unit gate uses. loc_04ac is reached only
// through m.call, which the construction-time override resolves (harness.js note).
function captureEntry() {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_04ac(mm); // let the host run proceed to a clean stop
  }]]);
  const host = makeMachine(snap);
  host.runFrames(MAX_FRAMES);
  if (entry === null) throw new Error(`loc_04ac never dispatched within ${MAX_FRAMES} frames`);
  return entry;
}

// Run oracle vs optimized on two clones of `entry`, with C poked to `c` (identical
// on both sides) to force a branch, and diff RAM + regs + pc + cycle total. Returns
// diagnostics incl. the entry and final 0x6905 (the arm signature).
function diffBranch(entry, c) {
  const a = entry.clone(); // translated
  const b = entry.clone(); // optimized
  for (const clone of [a, b]) clone.regs.c = c;
  const entryOut = a.mem.read8(OUT_ADDR);
  const entryA = a.regs.a;
  const cA0 = a.cycles, cB0 = b.cycles;
  translated_04ac(a);
  optimized_04ac(b);
  const dA = a.cycles - cA0, dB = b.cycles - cB0;

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  const regs = firstRegDiff(a.regs, b.regs);
  return { ram, regs, pcEq: a.pc === b.pc, dA, dB, entryOut, entryA, out: a.mem.read8(OUT_ADDR) };
}

test("BRANCH (unit): EXIT-1 (bit6 clear, ret z) — single store EQUAL (RAM+regs+pc+cycles=32t)", () => {
  const r = diffBranch(captureEntry(), 0x00);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)} (${r.ram.a} vs ${r.ram.b})` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.ok(r.pcEq, "pc must match");
  assert.equal(r.dA, r.dB, `cycle-total mismatch (translated ${r.dA} vs optimized ${r.dB})`);
  assert.equal(r.dA, 32, `EXIT-1 must total 32 t (got ${r.dA})`);
  // ret z arm: 0x6905 is written back with the value it held -> unchanged.
  assert.equal(r.out, r.entryA, "EXIT-1 must store A unchanged (no blink flip)");
  console.log(`  BRANCH/EXIT-1: ret z arm EQUAL, 0x6905 unchanged, cycles match (${r.dA} t)`);
});

test("BRANCH (unit): EXIT-2 (bit6 set, low3!=0, ret nz) — single store EQUAL (RAM+regs+pc+cycles=52t)", () => {
  const r = diffBranch(captureEntry(), 0x41);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)} (${r.ram.a} vs ${r.ram.b})` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.ok(r.pcEq, "pc must match");
  assert.equal(r.dA, r.dB, `cycle-total mismatch (translated ${r.dA} vs optimized ${r.dB})`);
  assert.equal(r.dA, 52, `EXIT-2 must total 52 t (got ${r.dA})`);
  assert.equal(r.out, r.entryA, "EXIT-2 must store A unchanged (no blink flip)");
  console.log(`  BRANCH/EXIT-2: ret nz arm EQUAL, 0x6905 unchanged, cycles match (${r.dA} t)`);
});

test("BRANCH (unit): EXIT-3 (bit6 set, low3==0) — blink flip + re-store EQUAL (RAM+regs+pc+cycles=80t)", () => {
  const r = diffBranch(captureEntry(), 0x40);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)} (${r.ram.a} vs ${r.ram.b})` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.ok(r.pcEq, "pc must match");
  assert.equal(r.dA, r.dB, `cycle-total mismatch (translated ${r.dA} vs optimized ${r.dB})`);
  assert.equal(r.dA, 80, `EXIT-3 must total 80 t (got ${r.dA})`);
  // blink arm: 0x6905 is re-stored as entryA XOR 0x03 (its signature).
  assert.equal(r.out, r.entryA ^ 0x03, "EXIT-3 must flip colour bits 0,1 and re-store (entryA ^ 0x03)");
  console.log(`  BRANCH/EXIT-3: blink flip arm EQUAL, 0x6905 = 0x${r.out.toString(16)} (entryA^3), cycles match (${r.dA} t)`);
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG — a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_04ac]]), { scenario: CONVERGENT_SCENARIO_04AC });

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

test("TEETH (unit): a wrong 0x6905 store is CAUGHT and names 0x6905", () => {
  const r = unitEquivalence(makeMachine, TARGET, translated_04ac, broken_04ac, { maxFrames: MAX_FRAMES });

  assert.equal(r.equal, false, "harness FAILED to catch a wrong store — it is worthless");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  assert.equal(
    r.ram.addr,
    OUT_ADDR,
    `expected first diff at the broken address 0x${OUT_ADDR.toString(16)}, got 0x${r.ram.addr.toString(16)}`,
  );
  console.log(
    `  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`,
  );
});
