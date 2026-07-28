// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for loc_04f1 (the colour-write + blink-OFF tail of the
 * intro/colour-cycle driver, ROM 0x04F1). It seeds a descending 3-cell colour-RAM
 * fill (sub_0514, seed 0xef, stride DE=0x20 from loc_0486) at 0x7583, then falls
 * straight into loc_04f9 which clears the blink bit7 of 0x6901/0x6905 and jp's back
 * to loc_04ac. Its ONE caller is loc_04be (`jp nc,0x04f1`), reached via loc_0486 <-
 * entry_03fb <- loc_197a — the per-frame in-game colour cascade — so it needs a
 * credited game AND loc_04be's branch B (BOARD 0x6227==4, frame-counter bit6 set,
 * MARIO_X >= 0x80).
 *
 * loc_04f1 is COLD/latent and even colder than its parent loc_04be: a driven board-1
 * game never sees BOARD==4, and even with BOARD=4 poked loc_04be only ever takes its
 * branch A (frame-counter bit6 clear here) so it never routes to 0x04f1. To exercise
 * it, three identical-both-sides pokes from frame 1040 force loc_04be's branch B:
 *   0x6227 = 4    (BOARD -- selects loc_0486's (0x6227)==4 arm -> loc_04be)
 *   0x6390 = 0x50 (frame counter; loc_0426 inc's it to 0x51, bit6 still SET, < 0x80)
 *   0x6203 = 0xc0 (MARIO_X >= 0x80 -> loc_04be's `cp 0x80 / jp nc,0x04f1`)
 * loc_04f1 then dispatches every frame from ~f1041 (261x in a 1300-frame window), and
 * the run stays healthy (reaches the vblank spin every frame). The pokes are
 * deterministic (oracle vs oracle-with-translated-override is byte-identical over
 * 1300 frames), so the whole-machine gate is meaningful, not vacuous.
 *
 * Five jobs:
 *
 *   1. CONVERGENT (whole-machine) — idiomatic optimized loc_04f1 CONVERGES against
 *      its translated oracle (pixels + persistent non-stack state), override
 *      firing hundreds of times (asserted >= 1). loc_04f1 is COLLAPSED (one m.step
 *      per basic block; see loc_04f1.js's CYCLES note) and sits inside the
 *      interruptible loc_197a -> entry_03fb per-frame cascade with the NMI mask
 *      ENABLED, so the convergent gate is the correct license, not the strict
 *      byte-exact one (docs/decompiler-pipeline; see sub_0350).
 *
 *   2. EQUAL (unit) — translated vs optimized leave identical RAM + all registers
 *      (incl. F, A, SP) + pc from the captured first-entry state (frame ~1041).
 *
 *   3. PATH (unit) — loc_04f1 is a SINGLE linear path (no internal data-dependent
 *      branch: load A=0xef, HL=0x7583, call sub_0514, fall into loc_04f9). That one
 *      path is proven EQUAL on a clone of the captured entry, asserting RAM + regs +
 *      pc AND the path's CYCLE TOTAL (the collapsed block's total is the oracle's
 *      exact sum, so a wrong charge still has explicit teeth), plus a colour-RAM /
 *      blink-bit SIGNATURE that proves the intended path actually ran: 0x7583=0xef
 *      (sub_0514's fill) and 0x6905 bit7 CLEAR (loc_04f9, blink OFF).
 *
 *   4+5. TEETH (convergent + unit) — the whole-machine teeth is a CYCLE-DROP twin,
 *      CAUGHT as a PERSISTENT divergence (forked PRNG) -- not a value-corruption
 *      twin, which risks hanging a long convergent run (see sub_0350's TEETH
 *      note). The unit teeth keeps the original deliberately-broken twin (the
 *      first colour-RAM store, 0x7583, lands the wrong value): CAUGHT, naming the
 *      diverging address.
 *
 * WHY THE CORE ENGINE + A CUSTOM FACTORY (not harness.js's wrappers). Same reason as
 * loc_04be / entry_03fb / loc_197a: harness.js bakes a makeMachine on `{}` assets
 * that drives NO input, so it never credits a game and never dispatches the loc_197a
 * -> ... -> loc_04be -> loc_04f1 cascade. This test calls the SAME core
 * unitEquivalence directly, with a makeMachine factory that attaches an identical
 * coin+start inputTape AND the identical branch-B pokes to BOTH sides (the factory is
 * shared, so every input/poke is applied identically to baseline and optimized). A
 * Machine built with no overrides runs the pure oracle. The convergent gate needs its
 * own scenario shape ({ frames, inputs, pokes }, per convergent.js's SCENARIOS), so
 * this test wires the SAME tape + pokes through a custom scenario object.
 *
 * CYCLE FINDING this routine adds: loc_04f1 is COLLAPSED (one m.step per basic
 * block). It is reached only from loc_04be, which sits inside the interruptible
 * loc_197a -> entry_03fb per-frame cascade (NMI mask ENABLED), and loc_04f1 falls
 * into further interruptible colour-tree routines (sub_0514 / loc_04f9 / loc_04ac),
 * so the vblank NMI can land inside it and push a live (now-coarser) PC into the
 * diffed stack RAM — exactly what the convergent gate licenses (measured clean:
 * pass=true, 361 invocations, 0 persistent state, over the branch-B scenario). The
 * path's cycle TOTAL is asserted equal on clones anyway, so total-preservation keeps
 * the PRNG spin count (0x6019) deterministic.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_04f1 as translated_04f1 } from "../../translated/state0.js";
import { loc_04f1 as optimized_04f1 } from "../loc_04f1.js";
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

const TARGET = 0x04f1;
const MAX_FRAMES = 1080; // loc_04f1 first dispatches at frame ~1041

// The first colour-RAM store on the routine's only path — sub_0514's first cell
// (0x7583, value 0xef). It sits in the compared video-RAM dump (0x7400-0x77FF) and
// is write-only on this path (nothing reads it back before the routine returns), so
// a corruption there is a clean caught diff.
const BROKEN_ADDR = 0x7583;

// A coin+start tape (identical to the loc_04be sibling's): coin on IN2 bit7 at frame
// 10, start1 on IN2 bit2 at frame 30 — credits and starts a game so the loc_197a ->
// entry_03fb -> loc_0486 cascade runs.
const COIN_START_TAPE = [
  { port: 0x7d00, bits: 0x80, frame: 10, dur: 6 }, // coin  (IN2 bit7)
  { port: 0x7d00, bits: 0x04, frame: 30, dur: 6 }, // start (IN2 bit2)
];

// loc_04f1 is reached only via loc_04be's branch B; three identical-both-sides pokes
// held from frame 1040 force it: BOARD=4 (into loc_04be), frame-counter bit6 set
// (loc_0426 inc's 0x50->0x51, still bit6 & < 0x80), MARIO_X >= 0x80.
const BRANCH_B_POKES = [
  { addr: 0x6227, val: 0x04, frame: 1040, dur: null }, // BOARD -> loc_04be
  { addr: 0x6390, val: 0x50, frame: 1040, dur: null }, // frame counter, bit6 set after inc
  { addr: 0x6203, val: 0xc0, frame: 1040, dur: null }, // MARIO_X >= 0x80 -> jp nc,0x04f1
];

// The makeMachine factory the core engine drives, extended to attach BOTH the
// coin+start inputTape and the branch-B pokes. Called with no argument for the
// baseline (pure oracle) and with the wrapped override map for the optimized side —
// both get the SAME tape and the SAME pokes.
function makeMachine(overrides) {
  const m = new Machine(ROM, overrides ? { overrides } : {});
  m.inputTape = COIN_START_TAPE.map((t) => ({ ...t }));
  m.pokes = BRANCH_B_POKES.map((p) => ({ ...p }));
  return m;
}

// The convergent gate needs its own scenario shape ({ frames, inputs, pokes }, per
// convergent.js's SCENARIOS) -- neither built-in SCENARIOS entry forces loc_04be's
// branch B, so this wires the SAME tape + pokes through a custom scenario object.
// frames:1400 gives margin past loc_04f1's ~f1041 first dispatch (261x by f1300).
const CONVERGENT_SCENARIO = {
  frames: 1400,
  inputs: COIN_START_TAPE.map((t) => ({ ...t })),
  pokes: BRANCH_B_POKES.map((p) => ({ ...p })),
};

/**
 * Deliberately-broken twin: behaviourally optimized_04f1 EXCEPT the first store to
 * 0x7583 lands a wrong value (the correct byte XOR 0xFF, guaranteed to differ).
 * Intercepting exactly that one write lets the rest of the routine and every
 * subroutine it calls run verbatim — the representative "wrong value to an address
 * on the routine's path" bug the gate must catch.
 */
function broken_04f1(m) {
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
    return optimized_04f1(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

// Cycle-broken twin for the CONVERGENT gate: identical logic to the collapsed
// routine, but the setup block's charge is 5 t short (17 -> 12). A wrong total
// shifts the main loop's spin count (0x6019 PRNG entropy) -- a PERSISTENT
// divergence, never a heal (see sub_0350's TEETH note for why this, not a
// value-corruption twin, is the right teeth under a long convergent run).
function cyclebroken_04f1(m) {
  const { regs } = m;
  regs.a = 0xef;
  regs.hl = 0x7583;
  m.step(0x04f6, 12); // DROPPED: the correct charge here is 17 t
  m.push16(0x04f9);
  m.step(0x0514, 17);
  m.call(0x0514);
  return m.call(0x04f9);
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine): collapsed loc_04f1 CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_04f1]]), { scenario: CONVERGENT_SCENARIO });

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
    `  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x (via loc_04be branch B, pokes forced); ` +
      `${r.pixDiffFrames} tear frame(s) (max ${r.maxPixels}px, healed), ` +
      `non-stack state persistent = ${r.statePersistent.length}`,
  );
});

test("EQUAL (unit): idiomatic optimized loc_04f1 matches translated in RAM + registers", () => {
  const r = unitEquivalence(makeMachine, TARGET, translated_04f1, optimized_04f1, { maxFrames: MAX_FRAMES });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F, A, SP) + pc identical (first entry: frame ~1041)");
});

// -- PATH COVERAGE (single linear path) ---------------------------------------

// Capture the pristine machine at loc_04f1's FIRST dispatch (frame ~1041), via the
// same construction-time snapshot the core unit gate uses.
function captureEntry() {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_04f1(mm); // let the host run proceed to a clean stop
  }]]);
  const host = makeMachine(snap);
  host.runFrames(MAX_FRAMES);
  if (entry === null) throw new Error(`loc_04f1 never dispatched within ${MAX_FRAMES} frames`);
  return entry;
}

test("PATH (unit): the single colour-fill + blink-OFF path EQUAL (RAM+regs+pc+cycles)", () => {
  const entry = captureEntry();
  const a = entry.clone(); // translated
  const b = entry.clone(); // optimized
  const cA0 = a.cycles, cB0 = b.cycles;
  translated_04f1(a);
  optimized_04f1(b);
  const dA = a.cycles - cA0, dB = b.cycles - cB0;

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  const regs = firstRegDiff(a.regs, b.regs);
  assert.equal(ram, null, ram ? `RAM diff at 0x${ram.addr.toString(16)} (${ram.a} vs ${ram.b})` : "");
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg} (${regs.a} vs ${regs.b})` : "");
  assert.ok(a.pc === b.pc, "pc must match");
  assert.equal(dA, dB, `cycle-total mismatch (translated ${dA} vs optimized ${dB})`);
  // Signature: sub_0514's fill wrote 0x7583=0xef, and loc_04f9 cleared the blink bit7.
  assert.equal(a.mem.read8(0x7583), 0xef, "path must run sub_0514's fill (0x7583=0xef)");
  assert.equal((a.mem.read8(0x6905) >> 7) & 1, 0, "path must clear the blink bit (loc_04f9, OFF)");
  console.log(`  PATH: colour-fill + blink-OFF EQUAL, 0x7583=0xef, blink OFF, cycles match (${dA} t)`);
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_04f1]]), { scenario: CONVERGENT_SCENARIO });

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

test("TEETH (unit): a wrong colour-RAM store is CAUGHT and names 0x7583", () => {
  const r = unitEquivalence(makeMachine, TARGET, translated_04f1, broken_04f1, { maxFrames: MAX_FRAMES });

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
