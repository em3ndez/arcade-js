// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for loc_0038 (ROM 0x0038) -- the `rst 0x38` entry that
 * fixes the stride/count (DE = 4, B = 0x0A) and FALLS THROUGH into sub_003d, the
 * shared "add C to a strided run of B bytes from HL" primitive. loc_0038 itself
 * reads/writes no fixed address: it loads two registers and falls through. Its one
 * successor, sub_003d, is reached via `m.call(0x003d)`, resolving through the routine
 * registry to the oracle (0x003d is not overridden in these tests).
 *
 * Five jobs:
 *
 *   1. CONVERGENT (whole-machine) -- the idiomatic COLLAPSED loc_0038 (optimized/loc_0038.js)
 *      converges against its translated oracle over a long driven gameplay run (pixels +
 *      persistent non-stack state). The override reaches it wherever a `rst 0x38` resolves
 *      it (via m.call), the construction-time seam the harness installs.
 *
 *   2. DISPATCH -- the override must actually fire, or EQUAL is vacuous. loc_0038 does
 *      NOT run in pure attract mode (0 hits over 240 boot frames); it first fires at
 *      frame ~160 of a coin+start run, laying out the 0x6908 sprite-object block during
 *      the opening-cutscene / board setup (all via `rst 0x38`, B=0x0A), then repeatedly
 *      through per-frame object updates over a long gameplay run.
 *
 *   3. TEETH -- a cycle-drop twin (convergent, catches a forked PRNG) AND a
 *      deliberately-broken VALUE twin at unit scale (the FIRST store on the routine's
 *      path lands a wrong value) must both be CAUGHT. loc_0038 writes no memory itself,
 *      so the first store is sub_003d's `ld (hl),a` at the caller's HL (0x6908 at the
 *      first entry) -- reached through the fall-through.
 *
 *   4. BRANCH / PATH COVERAGE -- loc_0038 has NO data-dependent branch: it
 *      unconditionally sets DE = 4 and B = 0x0A and falls through, whatever the caller
 *      passes. So there is one path and nothing to synthesise per-arm. It is proven
 *      EQUAL on a synthesised entry with a DIFFERENT caller context (different HL + C)
 *      -- showing the setup is input-independent and the fall-through actually runs the
 *      ten-pass stride-4 loop -- AND its cycle TOTAL is asserted equal to the oracle's,
 *      giving the collapsed 17 T (10+7) charge teeth.
 *
 * ATOMICITY DECISION recorded here: loc_0038 is COLLAPSED (its two m.step charges folded
 * to one 17 T exit charge). It is the `rst 0x38` vector -- the same rst family as
 * sub_0008 / sub_0010 / sub_0018 -- reached from 40+ sites, so it is NOT provably atomic
 * on every call path. Rather than keep the strict whole-machine gate (which is a property
 * of the SCENARIO tested, not of the routine -- see sub_0350) the CONVERGENT gate is used
 * unconditionally: it tolerates a healing NMI-mistimed tear/dead-stack PC and still catches
 * any PERSISTENT divergence (wrong cycle total, wrong memory op, forked PRNG). See
 * optimized/loc_0038.js.
 *
 * WHY THIS TEST DRIVES A TAPE (like sub_003d / loc_1880, it cannot use the fixed-factory
 * DK harness wrapper). loc_0038 never runs from boot -- it needs a real in-game state-3
 * context -- so a coin+start tape is loaded onto the machine and the game-agnostic CORE
 * engine (core/equivalence.js) is driven through a custom makeMachine factory (the same
 * construction-time snapshot override the DK wrapper uses). The tape is applied
 * IDENTICALLY to the baseline and optimized sides.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0038 as translated_0038 } from "../../translated/nmi.js";
import { loc_0038 as optimized_0038 } from "../loc_0038.js";
import { Machine } from "../../machine.js";
import {
  unitEquivalence as coreUnitEquivalence,
  firstStateDiff,
  firstRegDiff,
} from "../../../../core/equivalence.js";
import { convergentGate, SCENARIOS } from "./convergent.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0038;
const MAXF = 200; // long enough for the unit/capture host to reach the first entry

// Canonical coin+start tape (same timing as sub_003d's): reach in-game GAME_STATE 3,
// whose board/cutscene setup runs the `rst 0x38` add-loops that flow through loc_0038.
const COIN_START_TAPE = [
  { port: 0x7d00, bits: 0x80, frame: 60, dur: 6 }, // coin
  { port: 0x7d00, bits: 0x04, frame: 90, dur: 6 }, // start1
];

// The engine's factory: a DK Machine on this ROM with the coin+start tape loaded.
// Called with no argument for the baseline and with the wrapped override map for the
// optimized side (the core engine wraps each override with its own invocation counter,
// so an EQUAL that never dispatched cannot pass vacuously).
const makeMachine = (overrides) => {
  const m = new Machine(ROM, overrides ? { overrides } : {});
  m.inputTape = COIN_START_TAPE.map((t) => ({ ...t }));
  return m;
};

/**
 * Capture ONE real entry to loc_0038 (via a construction-time snapshot override on the
 * tape-driven host). Reusing a real captured entry gives a valid stack (the fall-through
 * `ret` unwinds it) and a live board context. The first entry is deterministic: frame
 * ~160, the first stride-4 object-block add-pass with HL = 0x6908, C = 0x30.
 */
function captureEntry() {
  let entry = null;
  const snapshot = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_0038(mm);
  }]]);
  const host = makeMachine(snapshot);
  host.runFrames(MAXF);
  assert.ok(entry !== null, "failed to capture a loc_0038 entry");
  return entry;
}

/**
 * Deliberately-broken twin: behaviourally the optimized routine EXCEPT its FIRST store
 * lands a wrong value (the correct byte XOR 0xFF, guaranteed to differ). loc_0038 writes
 * nothing itself, so the first store is sub_003d's `ld (hl),a` at the entry HL -- reached
 * through the fall-through. Intercepting exactly that one write lets the rest of the loop
 * and everything else run verbatim -- the representative "wrong value to one of the
 * routine's own output addresses" bug the gate must catch.
 */
function broken_0038(m) {
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
    return optimized_0038(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine): collapsed loc_0038 CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  // loc_0038 is COLLAPSED and reached from 40+ sites whose atomicity is not provable on
  // every call path, so the strict byte-exact gate is the wrong tool (it would false-fail
  // on a mistimed-NMI raster tear / dead-stack PC on a path this short driven run never
  // hits). The convergent gate is the correct license -- see optimized/loc_0038.js.
  // loc_0038 needs an actual coin+start run to dispatch (0 hits in pure attract), so use
  // SCENARIOS.gameplay.
  const r = convergentGate(new Map([[TARGET, optimized_0038]]), { scenario: SCENARIOS.gameplay });

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

test("EQUAL (unit): idiomatic optimized loc_0038 matches translated in RAM + registers", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_0038, optimized_0038, { maxFrames: MAXF });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical (first entry: frame ~160, HL=0x6908)");
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  // The convergent gate tolerates transient tears but MUST catch a real (non-healing)
  // error. A short charge shifts the main-loop spin count (0x6019, PRNG entropy), forking
  // the RANDOM stream permanently -- never a value-corruption twin here (it can hang a
  // long convergent run instead of diverging cleanly; see unit TEETH below for that case).
  function cyclebroken_0038(m) {
    const { regs } = m;
    regs.de = 0x0004;
    regs.b = 0x0a;
    m.step(0x003d, 12); // DROPPED: correct total is 17 t (10 + 7), short by 5
    return m.call(0x003d);
  }
  const r = convergentGate(new Map([[TARGET, cyclebroken_0038]]), { scenario: SCENARIOS.gameplay });

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

test("TEETH (unit): a wrong first store is CAUGHT and names the entry HL (0x6908)", () => {
  // loc_0038 writes nothing itself; the first store on its path is sub_003d's
  // `ld (hl),a` at the captured entry's HL (the caller's base pointer). Derived from
  // a captured entry, not hardcoded.
  const entry = captureEntry();
  const expectAddr = entry.regs.hl;
  assert.equal(expectAddr, 0x6908, `expected first entry HL 0x6908 (the object-block base), got 0x${expectAddr.toString(16)}`);

  const r = coreUnitEquivalence(makeMachine, TARGET, translated_0038, broken_0038, { maxFrames: MAXF });

  assert.equal(r.equal, false, "harness FAILED to catch a wrong store — it is worthless");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  assert.equal(
    r.ram.addr,
    expectAddr,
    `expected first diff at the entry HL 0x${expectAddr.toString(16)}, got 0x${r.ram.addr.toString(16)}`,
  );
  console.log(
    `  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} ` +
      `(translated ${r.ram.a} vs broken ${r.ram.b})`,
  );
});

// -- PATH COVERAGE (single unconditional path; input-independent + cycle total) --

test("PATH (input-independent): a different HL+C still fixes DE=4/B=0x0A — EQUAL + cycle total", () => {
  const entry = captureEntry();

  // Prove the setup does NOT depend on the caller's registers: seed a DIFFERENT base
  // (HL=0x6100, ten work-RAM bytes stride 4) and addend (C=0x11), then run oracle vs
  // optimized on two clones. loc_0038 must ignore both and drive sub_003d with DE=4,
  // B=0x0A regardless.
  const seed = entry.clone();
  seed.regs.hl = 0x6100;
  seed.regs.c = 0x11;
  const seedHL = seed.regs.hl;
  const before = seed.mem.read8(seedHL);

  const a = seed.clone(); // translated oracle
  const b = seed.clone(); // optimized

  const aCyc0 = a.cycles;
  translated_0038(a);
  const oracleCycles = a.cycles - aCyc0;

  const bCyc0 = b.cycles;
  optimized_0038(b);
  const optCycles = b.cycles - bCyc0;

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  const regs = firstRegDiff(a.regs, b.regs);
  assert.equal(ram, null, ram ? `RAM diff at 0x${ram.addr.toString(16)} (${ram.a} vs ${ram.b})` : "");
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg} (${regs.a} vs ${regs.b})` : "");
  assert.equal(a.pc, b.pc, "pc must match");

  // Teeth on the cycle total: a wrong per-instruction charge (or a lost/added fall-
  // through cycle) would be caught here. Same total both sides -- 10 T + 7 T prologue
  // plus sub_003d's ten-pass loop, reached identically through the fall-through.
  assert.equal(optCycles, oracleCycles, `cycle total ${optCycles} != oracle ${oracleCycles}`);

  // Non-vacuous: loc_0038 set the fixed parameters and the fall-through ran the loop.
  assert.equal(a.regs.de, 0x0004, `DE must be the fixed stride 4 (got 0x${a.regs.de.toString(16)})`);
  assert.equal(a.regs.b, 0, `B must end 0 after 10 djnz passes (got ${a.regs.b})`);
  assert.equal(
    a.regs.hl,
    (seedHL + 10 * 4) & 0xffff,
    `HL must advance by 10*stride to 0x${((seedHL + 10 * 4) & 0xffff).toString(16)} (got 0x${a.regs.hl.toString(16)})`,
  );
  assert.equal(
    a.mem.read8(seedHL),
    (before + 0x11) & 0xff,
    "first byte must be (before + C) & 0xff -- proves the fall-through added C",
  );

  console.log(
    `  PATH input-independent: EQUAL (RAM+regs+pc); ${oracleCycles}t both sides; ` +
      `DE=4, B->0, HL 0x${seedHL.toString(16)} -> 0x${a.regs.hl.toString(16)} (10 passes)`,
  );
});
