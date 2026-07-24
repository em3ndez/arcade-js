// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for loc_1a15 (ROM 0x1A15): the INIT step (idx1) of the
 * bonus-expired state machine at 0x6386 (BONUS_EXPIRED_STEP). Each frame the gameplay
 * cascade loc_197a runs `ld a,(0x6386) / rst 0x28` at ROM 0x1A07 (entry_1a07), which
 * dispatches idx0..3. When BONUS reaches 0 the bonus-decrement sites set 0x6386=1, so
 * entry_1a07 dispatches loc_1a15: it clears the delay counter (0x6387), advances the
 * machine to state 2 (DELAY), and falls into the shared 0x1A1E `ret`.
 *
 * loc_1a15 is a straight-line, branch-free routine, so there is exactly ONE path;
 * "full branch coverage" is that single path, proven EQUAL in RAM + all registers +
 * pc AND in its COLLAPSED cycle TOTAL (47t = 37t body + the shared 10t ret), with
 * non-vacuous output probes (0x6386 == 2 and 0x6387 == 0 afterwards).
 *
 * loc_1a15 is ATOMIC: it runs only via entry_1a07 <- loc_197a, which the vblank-NMI
 * handler entry_0066 runs with the NMI mask CLEARED (acked at ROM 0x0072, re-enabled
 * only at the 0x00D6 epilogue), so no nested NMI lands inside loc_1a15 (measured:
 * 158/158 entries with the mask clear). Its collapse is therefore byte-exact and the
 * STRICT whole-machine gate proves it (as loc_144f's does) -- the convergent gate,
 * which only licenses an interruptible collapse's transient raster tear, is not needed
 * here (docs/06). Confirmed directly: the collapsed loc_1a15 reads EQUAL byte-for-byte
 * over 1150 frames / 108 invocations, and a wrong-cycle twin is CAUGHT in the stack
 * region (0x6BFE) -- the NMI-stack-landing channel (docs/06 "Cycles" channel 2).
 *
 * Jobs (mirrors equivalence-144f -- same NMI-path, atomic, single-block shape):
 *
 *   1. EQUAL (whole-machine, STRICT) -- optimized loc_1a15 reads EQUAL against its
 *      oracle every frame, the override firing, on a driven run that forces the real
 *      idx1 body (0x6386 held at 1 during active gameplay). Routes through
 *      dispatchGameState's consult, inert when the map is empty.
 *   2. EQUAL (unit) -- EQUAL in RAM + every register (F included) + pc, on the
 *      naturally-captured (poke-driven) first entry to loc_1a15.
 *   3. TEETH (whole-machine, value) -- a broken twin whose store to the DELAY COUNTER
 *      (0x6387) lands a wrong value is CAUGHT: NOT-EQUAL, naming 0x6387. 0x6387 is
 *      loc_1a15's OWN output, is NOT held by any poke, and is control-flow-safe (state
 *      is held at 1, so loc_1a1f never reads it), so the corruption persists.
 *      NB: 0x6386 CANNOT be the value-teeth target -- it is re-poked to 1 every frame
 *      (the reach below holds it), so a wrong store to it is overwritten at the next
 *      frame boundary and MASKED (the docs/06 "re-poked output masks the store"
 *      wrinkle). The whole-machine value teeth therefore targets 0x6387; the 0x6386
 *      advance is proven instead by the unit + PATH output probes below.
 *   4. TEETH (whole-machine, cycles) -- a broken twin that charges 27t instead of the
 *      oracle's 37t is CAUGHT: a wrong total shifts where a later frame's NMI pushes
 *      its PC, diverging in the stack region (docs/06 "Cycles" channel 2).
 *   5. TEETH (unit, value) -- the same broken 0x6387 store is caught and names 0x6387
 *      on the naturally-captured entry.
 *   6. PATH (single-arm coverage) -- the one path proven EQUAL RAM + regs + pc AND
 *      cycle TOTAL == oracle (== 47t, pinned absolute) on the captured entry, with the
 *      output probes (a garbage 0x6387 is cleared to 0; 0x6386 becomes 2); plus a
 *      wrong-cycle twin that FAILS the cycle-total assertion (the collapse's teeth).
 *
 * WHY THIS TEST DRIVES A POKE (like 144f/141e). loc_1a15 never dispatches in a boot,
 * attract, or plain coin+start window: it fires only after the on-screen BONUS hits 0,
 * which no short run reaches (measured 0 dispatches in 1200-frame attract and in plain
 * coin+start gameplay). An IDENTICAL-BOTH-SIDES poke (Karl's sanctioned "poke the board
 * state to reach a state for validation") forces it: a real coin+start tape credits and
 * enters active 25m play (loc_197a dispatches from ~frame 1043), and BONUS_EXPIRED_STEP
 * (0x6386) is HELD at 1 from frame 1000 -- so entry_1a07 reads 1 every frame and
 * dispatches loc_1a15, which sets 0x6386=2, and the held poke re-arms it to 1 next
 * frame (a fresh idx1 dispatch each frame, ~108 over the window). The poke is threaded
 * via a makeMachine factory (m.pokes + m.inputTape) driving the game-agnostic CORE
 * engine, applied to baseline and optimized alike so equivalence is preserved.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1a15 as translated_1a15 } from "../../translated/state0.js";
import { loc_1a15 as optimized_1a15 } from "../loc_1a15.js";
import { Machine } from "../../machine.js";
import {
  wholeMachineEquivalence as coreWholeMachineEquivalence,
  unitEquivalence as coreUnitEquivalence,
  firstStateDiff,
  firstRegDiff,
} from "../../../../core/equivalence.js";
import { BONUS_EXPIRED_STEP } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1a15;
const FRAMES = 1150; // active 25m play begins ~f1043; this gives ~108 idx1 dispatches
const MAXFRAMES_UNIT = 1150; // enough to reach the first (~f1043) entry

const DELAY_COUNTER = 0x6387; // loc_1a15's own store (unnamed scratch in ram.js; see NAMES)
const POKE_FRAME = 1000; // hold 0x6386=1 from here (before gameplay begins ~f1043)

// Identical-both-sides reach: a real coin+start tape to enter active gameplay, plus a
// HELD poke of BONUS_EXPIRED_STEP=1 so entry_1a07 dispatches loc_1a15 every frame.
const COIN_START_TAPE = [
  { port: 0x7d00, bits: 0x80, frame: 10, dur: 6 }, // coin  (IN2 bit7)
  { port: 0x7d00, bits: 0x04, frame: 40, dur: 6 }, // start1 (IN2 bit2)
];
const FORCE_1A15_POKE = [
  { addr: BONUS_EXPIRED_STEP, val: 0x01, frame: POKE_FRAME, dur: null }, // 0x6386 = 1 (held)
];

const makeMachine = (overrides) => {
  const m = new Machine(ROM, overrides ? { overrides } : {});
  m.inputTape = COIN_START_TAPE.map((t) => ({ ...t }));
  m.pokes = FORCE_1A15_POKE.map((p) => ({ ...p }));
  return m;
};

/**
 * Deliberately-broken VALUE twin: behaviourally the optimized handler EXCEPT the
 * store to `addr` lands a wrong value (the correct byte XOR 0xFF, guaranteed to
 * differ). Intercepting exactly that one write lets the rest of the routine run
 * verbatim -- the representative "wrong value to one of the routine's own output
 * addresses" bug the gate must catch.
 */
function makeBroken(addr) {
  return function broken(m) {
    const realWrite = m.mem.write8.bind(m.mem);
    let broke = false;
    m.mem.write8 = (a, value, busOffset) => {
      if (!broke && a === addr) {
        broke = true;
        return realWrite(a, value ^ 0xff, busOffset);
      }
      return realWrite(a, value, busOffset);
    };
    try {
      return optimized_1a15(m);
    } finally {
      m.mem.write8 = realWrite;
    }
  };
}

const brokenDelayCounter = makeBroken(DELAY_COUNTER); // loc_1a15's own store to 0x6387

/**
 * Deliberately-broken CYCLE twin: identical behaviour and identical RAM/register
 * effects, but charges 27t for the collapsed block instead of the oracle's 37t. The
 * wrong TOTAL shifts where a later frame's vblank NMI pushes its PC, so the diff
 * diverges in the stack region (docs/06 "Cycles" channel 2). It also fails the unit
 * cycle-total assertion below.
 */
function brokenCycles(m) {
  const { regs, mem } = m;
  regs.xor(regs.a);
  mem.write8(DELAY_COUNTER, regs.a);
  regs.a = 0x02;
  mem.write8(BONUS_EXPIRED_STEP, regs.a);
  m.step(0x1a1e, 27); // WRONG: 27t instead of the oracle's 37t
  m.ret(10);
}

// -- EQUAL --------------------------------------------------------------------

test("EQUAL (whole-machine): idiomatic optimized loc_1a15 matches translated every frame", () => {
  const r = coreWholeMachineEquivalence(makeMachine, FRAMES, new Map([[TARGET, optimized_1a15]]));

  // The override must actually have run, or EQUAL would be vacuous.
  assert.ok(
    r.invocations.get(TARGET) >= 1,
    `override at 0x${TARGET.toString(16)} never dispatched (invocations=${r.invocations.get(TARGET)})`,
  );
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `diverged at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
  assert.equal(r.framesCompared, FRAMES);
  console.log(
    `  EQUAL/whole: ${r.framesCompared} frames identical, override fired ${r.invocations.get(TARGET)}x`,
  );
});

test("EQUAL (unit): idiomatic optimized loc_1a15 matches translated in RAM + registers", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_1a15, optimized_1a15, { maxFrames: MAXFRAMES_UNIT });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical (idx1 INIT entry)");
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (whole-machine, value): a wrong delay-counter store is CAUGHT and NOT-EQUAL", () => {
  const r = coreWholeMachineEquivalence(makeMachine, FRAMES, new Map([[TARGET, brokenDelayCounter]]));

  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "harness FAILED to catch a wrong store -- it is worthless");
  assert.equal(typeof r.frame, "number");
  assert.ok(r.addr != null, "a caught divergence must name an address");
  console.log(
    `  TEETH/whole/value: caught at frame ${r.frame}, addr 0x${r.addr.toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
});

test("TEETH (whole-machine, cycles): a 27t (vs 37t) collapse is CAUGHT and NOT-EQUAL", () => {
  const r = coreWholeMachineEquivalence(makeMachine, FRAMES, new Map([[TARGET, brokenCycles]]));

  assert.ok(r.invocations.get(TARGET) >= 1, "broken-cycle override must have dispatched");
  assert.equal(r.equal, false, "harness FAILED to catch a wrong cycle total -- the collapse is unguarded");
  console.log(
    `  TEETH/whole/cycles: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
});

test("TEETH (unit, value): a wrong delay-counter store is CAUGHT and names 0x6387", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_1a15, brokenDelayCounter, { maxFrames: MAXFRAMES_UNIT });

  assert.equal(r.equal, false, "harness FAILED to catch a wrong store -- it is worthless");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  assert.equal(
    r.ram.addr,
    DELAY_COUNTER,
    `expected first diff at the broken address 0x${DELAY_COUNTER.toString(16)}, got 0x${r.ram.addr.toString(16)}`,
  );
  console.log(
    `  TEETH/unit/value: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`,
  );
});

// -- SINGLE-PATH COVERAGE (EQUAL RAM + regs + pc + collapsed cycle TOTAL) -------

/** Capture the one real entry to loc_1a15 (via the engine's construction-time
 * snapshot override on the poke-driven host), so the synthesised path inherits a
 * valid stack and realistic RAM. */
let ENTRY = null;
function capturedEntry() {
  if (ENTRY) return ENTRY;
  let entry = null;
  const snapshot = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1a15(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(MAXFRAMES_UNIT);
  assert.ok(entry !== null, "loc_1a15 never entered -- cannot prove the path");
  ENTRY = entry;
  return ENTRY;
}

/** Run oracle and `variant` from an identical captured entry (with a garbage 0x6387
 * pre-poked so the "clear" output probe is non-vacuous), returning the RAM/reg/pc
 * diffs and each side's cycle delta across the routine. clone() neutralises the frame
 * machinery, so the cycle count is exactly the routine's own (37t body + 10t ret). */
function runPath(variant) {
  const a = capturedEntry().clone(); // translated oracle
  const b = capturedEntry().clone(); // variant under test
  a.mem.write8(DELAY_COUNTER, 0x55); // garbage so `clear -> 0` is a real change
  b.mem.write8(DELAY_COUNTER, 0x55);
  const ca0 = a.cycles;
  const cb0 = b.cycles;
  translated_1a15(a);
  variant(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    cyclesOracle: a.cycles - ca0,
    cyclesVariant: b.cycles - cb0,
    oracle: a,
  };
}

test("PATH (idx1 INIT): EQUAL RAM + regs + pc + collapsed cycle total; loc_1a15 sets 0x6386=2, 0x6387=0", () => {
  const r = runPath(optimized_1a15);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)} (t ${r.ram.a} vs o ${r.ram.b})` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (t ${r.regs.a} vs o ${r.regs.b})` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.equal(r.cyclesVariant, r.cyclesOracle, "cycle total must equal the oracle's");
  assert.equal(r.cyclesOracle, 47, "the idx1 total is 37t body + 10t shared ret = 47t (pinned absolute)");
  // Non-vacuous output probes: loc_1a15's distinctive effects.
  assert.equal(r.oracle.mem.read8(BONUS_EXPIRED_STEP), 0x02, "loc_1a15 must advance the state machine (0x6386) to 2");
  assert.equal(r.oracle.mem.read8(DELAY_COUNTER), 0x00, "loc_1a15 must clear the delay counter (0x6387) to 0");
  console.log(`  PATH: EQUAL, cycles ${r.cyclesVariant} (== oracle, == 47t); 0x6386==2, 0x6387 0x55->0`);
});

test("PATH teeth (cycles): the wrong-cycle twin FAILS the cycle-total assertion", () => {
  const r = runPath(brokenCycles);
  assert.notEqual(
    r.cyclesVariant,
    r.cyclesOracle,
    "the cycle-total check is toothless -- a 27t-vs-37t collapse must differ",
  );
  assert.equal(r.cyclesOracle - r.cyclesVariant, 10, "the 10t drop must be exactly the difference the twin injects");
  console.log(`  PATH teeth/cycles: oracle ${r.cyclesOracle} vs broken ${r.cyclesVariant} (Δ${r.cyclesOracle - r.cyclesVariant}) -- caught`);
});
