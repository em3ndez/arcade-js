// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for loc_144f (ROM 0x144F): loc_141e's "record == 3
 * found" tail. loc_141e (entry idx20 of loc_06fe's 0x0702 rst-0x28 table, reached
 * from INSIDE the NMI while GAME_STATE(0x6005)==3 and GAME_SUBSTATE(0x600A)==0x14)
 * clears the player index (0x600E) + score-slot selector (0x600D), then scans the
 * five 0x611C-based records (stride 0x22) FIRST for a byte == 1 (-> loc_1459), else
 * == 3 (-> loc_144f). loc_144f sets the player index (0x600E) and CURRENT_PLAYER
 * (0x600D) to 1 (player 2 up), loads A = 0, and FALLS THROUGH into loc_1459.
 *
 * loc_144f is a straight-line, branch-free routine, so there is exactly ONE path;
 * "full branch coverage" is that single path, proven EQUAL in RAM + all registers +
 * pc AND in its COLLAPSED cycle TOTAL (40t + the identical loc_1459 tail), with a
 * non-vacuous output probe (0x600E and 0x600D both == 1 afterwards).
 *
 * loc_144f is ATOMIC: it runs only via loc_141e, which executes inside the vblank
 * NMI (mask cleared on entry, non-reentrant), so no nested NMI lands inside loc_144f
 * or the loc_1459 it falls into. Its collapse is therefore byte-exact and the STRICT
 * whole-machine gate proves it (as its parent loc_141e's test does) -- the convergent
 * gate, which only licenses an interruptible collapse's transient raster tear, is not
 * needed here (docs/decompiler-pipeline: "A byte-exact collapse of an ATOMIC routine passes the
 * ordinary strict gate and does NOT need this").
 *
 * Jobs (mirrors equivalence-141e -- same NMI-path, rst-0x18-gated shape, one tail
 * deeper):
 *
 *   1. EQUAL (whole-machine, STRICT) -- optimized loc_144f reads EQUAL against its
 *      oracle every frame, the override firing, on a driven run that forces the real
 *      record==3 body (0x611C == 3, no record==1). Routes through dispatchGameState's
 *      consult (nmi.js), inert when the map is empty.
 *   2. EQUAL (unit) -- EQUAL in RAM + every register (F included) + pc, on the
 *      naturally-captured first entry to loc_144f.
 *   3. TEETH (whole-machine, value) -- a broken twin whose store to the player index
 *      (0x600E) lands a wrong value is CAUGHT: NOT-EQUAL, naming a diverging address.
 *      0x600E is loc_144f's OWN output, is NOT held by any poke, is control-flow-safe
 *      (it does not steer the dispatch), and -- since the gate expires once, so
 *      loc_141e never re-clears it -- the corruption persists.
 *   4. TEETH (whole-machine, cycles) -- a broken twin that charges 30t instead of the
 *      oracle's 40t is CAUGHT: a wrong total reseeds the PRNG (SPIN_COUNT 0x6019) and
 *      the whole-machine trace diverges (docs/decompiler-pipeline "Cycles" channel 1).
 *   5. TEETH (unit, value) -- the same broken 0x600E store is caught and names 0x600E
 *      on the naturally-captured entry.
 *   6. PATH (single-arm coverage) -- the one path proven EQUAL RAM + regs + pc AND
 *      cycle TOTAL == oracle on a synthesised entry, with the output probe; plus a
 *      wrong-cycle twin that FAILS the cycle-total assertion (the collapse's teeth).
 *
 * WHY THIS TEST DRIVES A POKE (like 141e/138f). loc_144f's substate 0x14 is a deep
 * in-game phase that never dispatches from a short boot/attract window. An
 * IDENTICAL-BOTH-SIDES poke (Karl's sanctioned "poke the board state to reach a state
 * for validation") forces it from frame 101: GAME_STATE=3 and GAME_SUBSTATE=0x14 held
 * (loc_141e's tails move 0x600A, so it must be re-pinned to re-dispatch); the five
 * 0x611C scan records held so NO slot == 1 but slot 0 == 3 (forces the record==3
 * branch into loc_144f); SUBSTATE_TIMER kicked to 1 once so the rst-0x18 gate expires
 * exactly once. The poke is threaded via a makeMachine factory (m.pokes) driving the
 * game-agnostic CORE engine, applied to baseline and optimized alike so equivalence
 * is preserved.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_144f as translated_144f } from "../../translated/state0.js";
import { loc_144f as optimized_144f } from "../loc_144f.js";
import { Machine } from "../../machine.js";
import {
  wholeMachineEquivalence as coreWholeMachineEquivalence,
  unitEquivalence as coreUnitEquivalence,
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

const TARGET = 0x144f;
const POKE_FRAME = 100;
const FRAMES = 140; // loc_141e is forced to dispatch from frame 101 on
const MAXFRAMES_UNIT = 150; // enough to reach the first (frame-101) entry

const GAME_STATE = 0x6005; // ram.js GAME_STATE (=3 selects the 0x0702 dispatch)
const GAME_SUBSTATE = 0x600a; // ram.js GAME_SUBSTATE (=0x14 -> loc_141e)
const SUBSTATE_TIMER = 0x6009; // ram.js SUBSTATE_TIMER (the rst-0x18 gate counter)
const CURRENT_PLAYER = 0x600d; // ram.js CURRENT_PLAYER (loc_144f sets it to 1)
const PLAYER_INDEX = 0x600e; // loc_144f's own store (unnamed scratch in ram.js)
const SCAN_BASE = 0x611c; // scan table base (unnamed scratch in ram.js)
const SCAN_STRIDE = 0x22;

// Identical-both-sides poke forcing loc_141e's substate + a record==3 body once.
// GAME_STATE + GAME_SUBSTATE are HELD (loc_141e's tails move 0x600A, so it must be
// re-pinned to re-dispatch); the five scan slots are held so NONE is 1 (record==1
// misses) but slot 0 is 3 (record==3 hits -> loc_144f); SUBSTATE_TIMER is kicked to
// 1 for one frame (the gate expires once, then the tail clears it).
const FORCE_144F_POKE = [
  { addr: GAME_STATE, val: 0x03, frame: POKE_FRAME, dur: null }, // GAME_STATE = 3 (held)
  { addr: GAME_SUBSTATE, val: 0x14, frame: POKE_FRAME, dur: null }, // GAME_SUBSTATE = 0x14 (held)
  { addr: SCAN_BASE + 0 * SCAN_STRIDE, val: 0x03, frame: POKE_FRAME, dur: null }, // slot0 == 3 (held) -> record==3
  { addr: SCAN_BASE + 1 * SCAN_STRIDE, val: 0x00, frame: POKE_FRAME, dur: null }, // slots 1..4 != 1 (held)
  { addr: SCAN_BASE + 2 * SCAN_STRIDE, val: 0x00, frame: POKE_FRAME, dur: null },
  { addr: SCAN_BASE + 3 * SCAN_STRIDE, val: 0x00, frame: POKE_FRAME, dur: null },
  { addr: SCAN_BASE + 4 * SCAN_STRIDE, val: 0x00, frame: POKE_FRAME, dur: null },
  { addr: SUBSTATE_TIMER, val: 0x01, frame: POKE_FRAME, dur: 1 }, // gate expires (kick once)
];

const makeMachine = (overrides) => {
  const m = new Machine(ROM, overrides ? { overrides } : {});
  m.pokes = FORCE_144F_POKE.map((p) => ({ ...p }));
  return m;
};

/**
 * Deliberately-broken VALUE twin: behaviourally the optimized handler EXCEPT the
 * first store to `addr` lands a wrong value (the correct byte XOR 0xFF, guaranteed to
 * differ). Intercepting exactly that one write lets the rest of the routine and the
 * loc_1459 it falls into run verbatim -- the representative "wrong value to one of the
 * routine's own output addresses" bug the gate must catch.
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
      return optimized_144f(m);
    } finally {
      m.mem.write8 = realWrite;
    }
  };
}

const brokenPlayerIndex = makeBroken(PLAYER_INDEX); // loc_144f's own store to 0x600E

/**
 * Deliberately-broken CYCLE twin: identical behaviour and identical RAM/register
 * effects, but charges 30t for the collapsed block instead of the oracle's 40t. The
 * wrong TOTAL reseeds the PRNG (SPIN_COUNT 0x6019) so the whole-machine trace must
 * diverge, and it fails the unit cycle-total assertion below.
 */
function brokenCycles(m) {
  const { regs, mem } = m;
  mem.write8(PLAYER_INDEX, 0x01);
  mem.write8(CURRENT_PLAYER, 0x01);
  regs.a = 0x00;
  m.step(0x1459, 30); // WRONG: 30t instead of the oracle's 40t
  return m.call(0x1459);
}

// -- EQUAL --------------------------------------------------------------------

test("EQUAL (whole-machine): idiomatic optimized loc_144f matches translated every frame", () => {
  const r = coreWholeMachineEquivalence(makeMachine, FRAMES, new Map([[TARGET, optimized_144f]]));

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

test("EQUAL (unit): idiomatic optimized loc_144f matches translated in RAM + registers", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_144f, optimized_144f, { maxFrames: MAXFRAMES_UNIT });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical (first entry = record==3 tail)");
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (whole-machine, value): a wrong player-index store is CAUGHT and NOT-EQUAL", () => {
  const r = coreWholeMachineEquivalence(makeMachine, FRAMES, new Map([[TARGET, brokenPlayerIndex]]));

  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "harness FAILED to catch a wrong store — it is worthless");
  assert.equal(typeof r.frame, "number");
  assert.ok(r.addr != null, "a caught divergence must name an address");
  console.log(
    `  TEETH/whole/value: caught at frame ${r.frame}, addr 0x${r.addr.toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
});

test("TEETH (whole-machine, cycles): a 30t (vs 40t) collapse is CAUGHT and NOT-EQUAL", () => {
  const r = coreWholeMachineEquivalence(makeMachine, FRAMES, new Map([[TARGET, brokenCycles]]));

  assert.ok(r.invocations.get(TARGET) >= 1, "broken-cycle override must have dispatched");
  assert.equal(r.equal, false, "harness FAILED to catch a wrong cycle total — the collapse is unguarded");
  console.log(
    `  TEETH/whole/cycles: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
});

test("TEETH (unit, value): a wrong player-index store is CAUGHT and names 0x600E", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_144f, brokenPlayerIndex, { maxFrames: MAXFRAMES_UNIT });

  assert.equal(r.equal, false, "harness FAILED to catch a wrong store — it is worthless");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  assert.equal(
    r.ram.addr,
    PLAYER_INDEX,
    `expected first diff at the broken address 0x${PLAYER_INDEX.toString(16)}, got 0x${r.ram.addr.toString(16)}`,
  );
  console.log(
    `  TEETH/unit/value: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`,
  );
});

// -- SINGLE-PATH COVERAGE (EQUAL RAM + regs + pc + collapsed cycle TOTAL) -------

/** Capture the one real entry to loc_144f (via the engine's construction-time
 * snapshot override on the poke-driven host), so the synthesised path inherits a
 * valid stack and realistic RAM. */
let ENTRY = null;
function capturedEntry() {
  if (ENTRY) return ENTRY;
  let entry = null;
  const snapshot = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_144f(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(MAXFRAMES_UNIT);
  assert.ok(entry !== null, "loc_144f never entered — cannot prove the path");
  ENTRY = entry;
  return ENTRY;
}

/** Run oracle and `variant` from an identical captured entry, returning the
 * RAM/reg/pc diffs and each side's cycle delta across the routine. clone()
 * neutralises the frame machinery, so the cycle count is exactly the routine's own +
 * its identical loc_1459 tail. */
function runPath(variant) {
  const a = capturedEntry().clone(); // translated oracle
  const b = capturedEntry().clone(); // variant under test
  const ca0 = a.cycles;
  const cb0 = b.cycles;
  translated_144f(a);
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

test("PATH (record==3): EQUAL RAM + regs + pc + collapsed cycle total; loc_144f sets 0x600E/0x600D=1", () => {
  const r = runPath(optimized_144f);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)} (t ${r.ram.a} vs o ${r.ram.b})` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (t ${r.regs.a} vs o ${r.regs.b})` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.equal(r.cyclesVariant, r.cyclesOracle, "cycle total must equal the oracle's (40t + identical loc_1459 tail)");
  // Non-vacuous output probe: loc_144f's distinctive effect. loc_1459 (fallen into)
  // touches neither, so both survive at 1.
  assert.equal(r.oracle.mem.read8(PLAYER_INDEX), 0x01, "loc_144f must set the player index (0x600E) to 1");
  assert.equal(r.oracle.mem.read8(CURRENT_PLAYER), 0x01, "loc_144f must set CURRENT_PLAYER (0x600D) to 1");
  console.log(`  PATH: EQUAL, cycles ${r.cyclesVariant} (== oracle); 0x600E==1, 0x600D==1 (loc_1459 tail ran)`);
});

test("PATH teeth (cycles): the wrong-cycle twin FAILS the cycle-total assertion", () => {
  const r = runPath(brokenCycles);
  assert.notEqual(
    r.cyclesVariant,
    r.cyclesOracle,
    "the cycle-total check is toothless — a 30t-vs-40t collapse must differ",
  );
  assert.equal(r.cyclesOracle - r.cyclesVariant, 10, "the 10t drop must be exactly the difference the twin injects");
  console.log(`  PATH teeth/cycles: oracle ${r.cyclesOracle} vs broken ${r.cyclesVariant} (Δ${r.cyclesOracle - r.cyclesVariant}) — caught`);
});
