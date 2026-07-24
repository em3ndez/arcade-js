// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for loc_0450 (the colour-cycle sprite dispatch at ROM
 * 0x0450: `ld a,(0x6227) / rrca / jp nc,0x0478 / rrca / jp c,0x0486 / ld hl,0x690b
 * / ld c,-4 / rst 0x38 / jp 0x0486` — a three-way dispatch on BOARD's low two bits
 * that picks which sprite-record offset, if any, to apply before the shared colour
 * tail loc_0486). It is a LEAF reached only via `m.call` from loc_0426 (fall-in)
 * and loc_0464 (`jp 0x0450`), themselves in the per-frame colour cascade loc_0413
 * <- entry_03fb <- loc_197a — so, like its siblings loc_0413 / entry_03fb, it needs
 * a credited game to run and is driven with a coin+start inputTape.
 *
 * DRIVING loc_0450 (why the extra poke). loc_0426 only falls into loc_0450 on a
 * 32-frame boundary of the animation counter 0x6390 AND when the gate byte 0x6393
 * is 0; in a natural credited run 0x6393 is 1 almost every frame, so that boundary-
 * with-gate-open almost never coincides (measured: 0 loc_0450 dispatches in 4000
 * frames via the loc_0426 boundary, ~1 via the loc_0464 cold arm). This test holds
 * 0x6393 = 0 (an engine-scratch byte loc_0450 NEVER reads) so the counter's 32-frame
 * boundary reliably routes into loc_0450 — first at frame 1318, then every 32 frames
 * (BOARD == 1 throughout, so the bit0==1/bit1==0 rst-0x38 arm). The poke lands
 * IDENTICALLY on baseline and optimized; it only steers execution INTO loc_0450 and
 * cannot change loc_0450's own behaviour (loc_0450 reads only BOARD).
 *
 * COLLAPSED (one m.step per basic block; see the docstring in ../loc_0450.js for
 * the per-arm cycle totals). The whole-machine gate is the CONVERGENT gate,
 * unconditionally: "atomic" is a property of the scenario tested, not of the
 * routine, so a strict pass here would be a brittle guarantee that could later
 * false-fail on a benign tear. Everything that actually matters (a wrong cycle
 * total, a wrong memory op, a forked PRNG) is a PERSISTENT divergence that the
 * convergent gate also catches; only the benign-tear false alarm is given up.
 *
 * Six jobs:
 *
 *   1. CONVERGENT (whole-machine) — the collapsed loc_0450 (optimized/loc_0450.js)
 *      CONVERGES against its translated oracle over the same coin+start+gate-poke
 *      run. It dispatches at f1318, f1350, f1382, f1414 (asserted).
 *
 *   2. EQUAL (unit) — translated vs optimized leave identical RAM + registers
 *      (incl. F, A) + pc from the captured entry (first dispatch, frame 1318,
 *      BOARD==1 -> the rst-0x38 branch C).
 *
 *   3+4+5. BRANCH COVERAGE — loc_0450's dispatch has three arms (BOARD low bits).
 *      The driven run only ever sees BOARD==1 (branch C). Each arm is proven EQUAL
 *      on clones of the captured entry with BOARD poked identically on BOTH sides,
 *      asserting RAM + regs + pc AND the branch's CYCLE TOTAL:
 *        - BOARD==2 (bit0==0)      : branch A -> loc_0478 (its own rst-0x38 arm)
 *        - BOARD==3 (bit0/1 both 1): branch B -> loc_0486 directly (no sprite shift)
 *        - BOARD==1 (bit0=1,bit1=0): branch C -> ld hl,0x690b / rst 0x38 / loc_0486
 *      Branch C's total exceeds branch B's by the rst-0x38 sprite-shift it runs and
 *      B skips — a cross-arm distinctness check proving the dispatch genuinely
 *      routes to different code, not a vacuous no-op.
 *
 *   6. TEETH (convergent + unit) — a deliberately-broken twin whose first colour-RAM
 *      store (0x75C4, written on every arm's path via loc_0486 -> loc_04a3 ->
 *      sub_0514) lands the wrong value must be CAUGHT.
 *
 * WHY THE CORE ENGINE + A CUSTOM FACTORY (not harness.js's wrappers). Same reason
 * as entry_03fb / loc_197a: harness.js bakes a makeMachine that drives NO input, so
 * it never credits a game and never reaches loc_0450. This test calls the SAME core
 * unitEquivalence directly (and the convergent gate below) with a makeMachine
 * factory that attaches an identical coin+start inputTape AND the 0x6393 gate poke
 * to BOTH sides. A Machine built with no overrides runs the pure oracle (machine.js:
 * the manifest's optimized routines are NOT auto-applied), so the baseline is the
 * oracle loc_0450 inside an all-oracle machine.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0450 as translated_0450 } from "../../translated/state0.js";
import { loc_0450 as optimized_0450 } from "../loc_0450.js";
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

const TARGET = 0x0450;
const MAX_FRAMES = 1330; // loc_0450 first dispatches at frame 1318

// Dispatch selector: `ld a,(0x6227) / rrca / jp nc,0x0478 / rrca / jp c,0x0486`.
const BOARD = 0x6227;

// Gate byte: loc_0426/loc_0464 only fall into loc_0450 when this is 0. Held 0 so the
// 32-frame counter boundary reliably routes into loc_0450. loc_0450 never reads it.
const GATE = 0x6393;

// The first colour-RAM store on loc_0450's path: every arm flows into loc_0486 ->
// ... -> loc_04a3, which sets HL=0x75c4 and calls sub_0514. It sits in the compared
// video-RAM dump (0x7400-0x77FF) and is write-only on this path (nothing reads it
// back before the routine returns), so a corruption there is a clean caught diff.
const BROKEN_ADDR = 0x75c4;

// Coin+start tape (identical to entry_03fb / loc_197a): coin on IN2 bit7 at frame 10,
// start1 on IN2 bit2 at frame 30. Credits and starts a game so the colour cascade runs.
const COIN_START_TAPE = [
  { port: 0x7d00, bits: 0x80, frame: 10, dur: 6 }, // coin  (IN2 bit7)
  { port: 0x7d00, bits: 0x04, frame: 30, dur: 6 }, // start (IN2 bit2)
];

// Hold the gate open so loc_0450 is reached each 32-frame boundary (see header).
const GATE_POKE = [{ addr: GATE, val: 0, frame: 0, dur: null }];

// The makeMachine factory the core engine drives, extended to attach the coin+start
// inputTape AND the gate poke. Called with no argument for the baseline (pure oracle)
// and with the wrapped override map for the optimized side — both get the SAME tape
// and the SAME poke.
function makeMachine(overrides) {
  const m = new Machine(ROM, overrides ? { overrides } : {});
  m.inputTape = COIN_START_TAPE.map((t) => ({ ...t }));
  m.pokes = GATE_POKE.map((p) => ({ ...p }));
  return m;
}

// The scenario the convergent gate drives: same coin+start tape + gate poke as
// above, run long enough to cover loc_0450's f1318..f1414 dispatches plus a
// reconvergence tail.
const SCENARIO = { frames: 1500, inputs: COIN_START_TAPE, pokes: GATE_POKE };

/**
 * Deliberately-broken twin: behaviourally optimized_0450 EXCEPT the first store to
 * 0x75C4 lands a wrong value (the correct byte XOR 0xFF, guaranteed to differ).
 * Intercepting exactly that one write lets the rest of the routine and every
 * subroutine it calls run verbatim — the representative "wrong value to an address
 * on the routine's path" bug the gate must catch. Safe over the SHORT unit-level
 * run; the convergent TEETH test below uses a cycle-drop twin instead (a
 * value-corruption twin over a long convergent run can hang the game).
 */
function broken_0450(m) {
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
    return optimized_0450(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

// Cycle-broken twin for the CONVERGENT gate: identical memory + registers to the
// collapsed routine, but the very first m.step charge is shaved by 5 t. A wrong
// cycle total shifts the main loop's spin count (0x6019, the PRNG entropy) -- a
// PERSISTENT non-stack divergence, never a heal.
function cyclebroken_0450(m) {
  const realStep = m.step.bind(m);
  let broke = false;
  m.step = (pc, cyc) => {
    if (!broke) { broke = true; return realStep(pc, cyc - 5); }
    return realStep(pc, cyc);
  };
  try {
    return optimized_0450(m);
  } finally {
    m.step = realStep;
  }
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine): collapsed loc_0450 CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_0450]]), { scenario: SCENARIO });

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
    `  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x (32-frame boundary via loc_0426, f1318..f1414); ` +
      `${r.pixDiffFrames} tear frame(s) (max ${r.maxPixels}px, healed), ` +
      `non-stack state persistent = ${r.statePersistent.length}`,
  );
});

test("EQUAL (unit): collapsed loc_0450 matches translated in RAM + registers", () => {
  const r = unitEquivalence(makeMachine, TARGET, translated_0450, optimized_0450, { maxFrames: MAX_FRAMES });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F, A, SP) + pc identical (first entry: frame 1318, BOARD==1 / branch C)");
});

// -- BRANCH COVERAGE ----------------------------------------------------------

// Capture the pristine machine at loc_0450's FIRST dispatch (frame 1318), via the
// same construction-time snapshot the core unit gate uses.
function captureEntry() {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_0450(mm); // let the host run proceed to a clean stop
  }]]);
  const host = makeMachine(snap);
  host.runFrames(MAX_FRAMES);
  if (entry === null) throw new Error(`loc_0450 never dispatched within ${MAX_FRAMES} frames`);
  return entry;
}

// Run oracle vs optimized on two clones of `entry`, with BOARD poked to `board`
// (identical on both sides), and diff RAM + regs + pc + cycle total.
function diffBranch(entry, board) {
  const a = entry.clone(); // translated
  const b = entry.clone(); // optimized
  for (const c of [a, b]) c.mem.write8(BOARD, board);
  const cA0 = a.cycles, cB0 = b.cycles;
  translated_0450(a);
  optimized_0450(b);
  const dA = a.cycles - cA0, dB = b.cycles - cB0;

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  const regs = firstRegDiff(a.regs, b.regs);
  return { ram, regs, pcEq: a.pc === b.pc, dA, dB };
}

test("BRANCH (unit): BOARD==2 (bit0==0) — branch A -> loc_0478 EQUAL (RAM+regs+pc+cycles)", () => {
  const r = diffBranch(captureEntry(), 0x02);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)} (${r.ram.a} vs ${r.ram.b})` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.ok(r.pcEq, "pc must match");
  assert.equal(r.dA, r.dB, `cycle-total mismatch (translated ${r.dA} vs optimized ${r.dB})`);
  console.log(`  BRANCH/A (BOARD==2): loc_0478 arm EQUAL, cycles match (${r.dA} t)`);
});

test("BRANCH (unit): BOARD==3 (bit0&bit1==1) — branch B -> loc_0486 EQUAL (RAM+regs+pc+cycles)", () => {
  const r = diffBranch(captureEntry(), 0x03);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)} (${r.ram.a} vs ${r.ram.b})` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.ok(r.pcEq, "pc must match");
  assert.equal(r.dA, r.dB, `cycle-total mismatch (translated ${r.dA} vs optimized ${r.dB})`);
  console.log(`  BRANCH/B (BOARD==3): loc_0486-direct arm EQUAL, cycles match (${r.dA} t)`);
});

test("BRANCH (unit): BOARD==1 (bit0=1,bit1=0) — branch C -> rst 0x38 + loc_0486 EQUAL, and distinct from B", () => {
  const entry = captureEntry();
  const c = diffBranch(entry, 0x01);
  assert.equal(c.ram, null, c.ram ? `RAM diff at 0x${c.ram.addr.toString(16)} (${c.ram.a} vs ${c.ram.b})` : "");
  assert.equal(c.regs, null, c.regs ? `reg diff at ${c.regs.reg} (${c.regs.a} vs ${c.regs.b})` : "");
  assert.ok(c.pcEq, "pc must match");
  assert.equal(c.dA, c.dB, `cycle-total mismatch (translated ${c.dA} vs optimized ${c.dB})`);

  // Distinctness: branch C runs the rst-0x38 sprite shift that branch B (BOARD==3)
  // skips, so its total must exceed B's — proof the dispatch routes to different
  // code, not a vacuous no-op that would pass for any BOARD.
  const b = diffBranch(entry, 0x03);
  assert.ok(
    c.dA > b.dA,
    `branch C (rst 0x38) should cost more than branch B (no shift): C=${c.dA} t vs B=${b.dA} t`,
  );
  console.log(`  BRANCH/C (BOARD==1): rst-0x38 arm EQUAL, cycles match (${c.dA} t); > branch B (${b.dA} t)`);
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_0450]]), { scenario: SCENARIO });

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

test("TEETH (unit): a wrong colour-RAM store is CAUGHT and names 0x75C4", () => {
  const r = unitEquivalence(makeMachine, TARGET, translated_0450, broken_0450, { maxFrames: MAX_FRAMES });

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
