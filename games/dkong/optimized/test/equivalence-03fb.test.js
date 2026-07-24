// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for entry_03fb (the ATTRACT / intro colour-cycle
 * driver's PROLOGUE at ROM 0x03FB: `ld a,(0x6227) / cp 0x02 / jp nz,0x0413`, a
 * two-way dispatch on BOARD that either jumps straight to the frame-flag tail
 * loc_0413 or, on BOARD==2, offsets one sprite record via rst 0x38 and stashes a
 * derived index at 0x63b7 before falling into loc_0413). Its ONE caller is
 * loc_197a @0x19B0, the per-frame in-game cascade, so — like loc_197a itself — it
 * needs a credited game to run and is driven with a coin+start inputTape.
 *
 * Six jobs:
 *
 *   1. EQUAL (whole-machine) — idiomatic optimized entry_03fb (optimized/entry_03fb.js)
 *      reads EQUAL against its translated oracle every frame. entry_03fb dispatches
 *      once per frame of board 1 via loc_197a: first at frame ~1033, then through
 *      ~f1230 (198 dispatches in a 1300-frame window), all EQUAL. The override must
 *      actually fire (asserted) or EQUAL would be vacuous.
 *
 *   2. EQUAL (unit) — translated vs optimized leave identical RAM + registers
 *      (incl. F) + pc from the captured entry state (first dispatch, frame ~1033,
 *      BOARD==1 so the != 2 / jp-nz arm).
 *
 *   3+4. BRANCH COVERAGE — entry_03fb's one data-dependent branch is `cp 0x02 /
 *      jp nz,0x0413` on BOARD (0x6227). The driven run only ever sees BOARD==1
 *      (198/198 entries -> the != 2 arm). Each arm is proven EQUAL on clones of the
 *      captured entry with BOARD poked identically on BOTH sides (an identical-both-
 *      sides poke), asserting RAM + regs + pc AND the branch's CYCLE TOTAL (kept
 *      per-instruction, so a wrong charge on the cold arm has explicit teeth):
 *        - BOARD != 2 (poke 0x01): jp nz taken, tail only          (355 t)
 *        - BOARD == 2 (poke 0x02): COLD fall-through arm — rst 0x38 + 0x63b7 store,
 *          then the tail                                           (868 t)
 *      A sentinel poked into 0x63b7 confirms which arm ran: the ==2 arm overwrites
 *      it (that store is the arm's signature), the !=2 arm leaves it untouched.
 *
 *   5+6. TEETH (whole + unit) — a deliberately-broken twin whose first colour-RAM
 *      store (0x75C4, written on the path via sub_0514) lands the wrong value must
 *      be CAUGHT: NOT-EQUAL, naming 0x75C4.
 *
 * WHY THE CORE ENGINE + A CUSTOM FACTORY (not harness.js's wrappers). Same reason
 * as loc_197a: harness.js bakes a makeMachine on `{}` assets that drives NO input,
 * so it never credits a game and never dispatches loc_197a -> never entry_03fb.
 * This test calls the SAME core unitEquivalence directly, plus the shared DK
 * convergentGate binding (test/convergent.js) for the whole-machine job, with a
 * makeMachine factory that attaches an identical coin+start inputTape to BOTH
 * sides (the factory is shared, so any input/poke is applied identically to
 * baseline and optimized). A Machine built with no overrides runs the pure oracle
 * (machine.js: the manifest's optimized routines are NOT auto-applied), so the
 * baseline is the oracle entry_03fb inside an all-oracle machine.
 *
 * CYCLE FINDING this routine adds: entry_03fb is NON-ATOMIC (its sole caller
 * loc_197a is the interruptible per-frame cascade, NMI mask ENABLED, and
 * entry_03fb spans rst 0x38 plus the entire interruptible loc_0413 colour tree) but
 * is COLLAPSED anyway (one m.step per basic block; see the routine's own
 * docstring) -- per the fleet-wide rule, "atomic" is a property of the scenario
 * exercised, not the routine, so the whole-machine gate uses the CONVERGENT
 * license UNCONDITIONALLY rather than a strict gate that would only be one
 * benign tear away from a false failure. Each branch's cycle TOTAL (355 t / 868 t)
 * is still asserted equal on clones by the BRANCH unit tests below, unaffected by
 * the collapse grain (kept byte-exact + cycle-exact, unchanged).
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { entry_03fb as translated_03fb } from "../../translated/state0.js";
import { entry_03fb as optimized_03fb } from "../entry_03fb.js";
import { Machine } from "../../machine.js";
import {
  unitEquivalence,
  firstStateDiff,
  firstRegDiff,
} from "../../../../core/equivalence.js";
import { convergentGate } from "./convergent.js";
import { SPRITE_OBJ_BLOCK } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x03fb;
const FRAMES = 1300; // entry_03fb dispatches f1033..~f1230 (198x) via loc_197a
const MAX_FRAMES = 1080; // entry_03fb first dispatches at frame ~1033

// Branch selector: `ld a,(0x6227) / cp 0x02 / jp nz,0x0413`.
const BOARD = 0x6227;

// The ==2 arm's SIGNATURE store — `ld (0x63b7),a`. It is the only writer of 0x63b7
// on either arm (the loc_0413 tail never touches it), so a sentinel poked here tells
// the two arms apart: the ==2 arm overwrites it, the !=2 arm leaves it.
const ARM_MARKER = 0x63b7;
const ARM_SENTINEL = 0xaa;

// The first colour-RAM store on entry_03fb's path (both arms flow into loc_0413 ->
// ... -> loc_04a3, which sets HL=0x75c4 and calls sub_0514). It sits in the compared
// video-RAM dump (0x7400-0x77FF) and is write-only on this path (nothing reads it
// back before the routine returns), so a corruption there is a clean caught diff.
const BROKEN_ADDR = 0x75c4;

// A coin+start tape (identical to loc_197a's): coin on IN2 bit7 at frame 10, start1
// on IN2 bit2 at frame 30. Credits and starts a game so loc_197a -> entry_03fb runs.
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

/**
 * Deliberately-broken twin: behaviourally optimized_03fb EXCEPT the first store to
 * 0x75C4 lands a wrong value (the correct byte XOR 0xFF, guaranteed to differ).
 * Intercepting exactly that one write lets the rest of the routine and every
 * subroutine it calls run verbatim — the representative "wrong value to an address
 * on the routine's path" bug the gate must catch.
 */
function broken_03fb(m) {
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
    return optimized_03fb(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

// -- EQUAL --------------------------------------------------------------------

// A custom convergent scenario reusing the SAME coin+start tape as makeMachine above
// (SCENARIOS.gameplay's fixed coin@400/start@460 timing would credit too late for
// entry_03fb's first dispatch at ~f1033 to land inside a 1200-frame window).
const CONVERGENT_SCENARIO = { frames: FRAMES, inputs: COIN_START_TAPE };

// Cycle-broken twin for the CONVERGENT gate: identical memory + registers to the
// collapsed routine, but the first block's total is 5 t short. A wrong total shifts
// the main loop's spin count (0x6019 PRNG entropy), forking the RANDOM stream: a
// PERSISTENT non-stack divergence, never a heal.
function cyclebroken_03fb(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(BOARD);
  regs.cp(0x02);
  m.step(0x0400, 15); // DROPPED: the correct charge here is 20 t
  if (regs.fNZ) {
    m.step(0x0413, 10);
    return m.call(0x0413);
  }
  regs.hl = SPRITE_OBJ_BLOCK;
  regs.a = mem.read8(0x63a3);
  regs.c = regs.a;
  m.step(0x040a, 37);
  m.push16(0x040b); m.step(0x0038, 11); m.call(0x0038);
  regs.a = mem.read8(0x6910);
  regs.sub(0x3b);
  mem.write8(0x63b7, regs.a);
  m.step(0x0413, 33);
  return m.call(0x0413);
}

test("CONVERGENT (whole-machine): collapsed entry_03fb CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_03fb]]), { scenario: CONVERGENT_SCENARIO });

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

test("EQUAL (unit): idiomatic optimized entry_03fb matches translated in RAM + registers", () => {
  const r = unitEquivalence(makeMachine, TARGET, translated_03fb, optimized_03fb, { maxFrames: MAX_FRAMES });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F, A, SP) + pc identical (first entry: frame 1033, BOARD==1 / != 2 arm)");
});

// -- BRANCH COVERAGE ----------------------------------------------------------

// Capture the pristine machine at entry_03fb's FIRST dispatch (frame ~1033), via the
// same construction-time snapshot the core unit gate uses.
function captureEntry() {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_03fb(mm); // let the host run proceed to a clean stop
  }]]);
  const host = makeMachine(snap);
  host.runFrames(MAX_FRAMES);
  if (entry === null) throw new Error(`entry_03fb never dispatched within ${MAX_FRAMES} frames`);
  return entry;
}

// Run oracle vs optimized on two clones of `entry`, with BOARD poked to `board` and a
// sentinel poked into 0x63b7 (both pokes identical on both sides), and diff RAM + regs
// + pc + cycle total. Returns diagnostics incl. the post-run 0x63b7 (arm marker).
function diffBranch(entry, board) {
  const a = entry.clone(); // translated
  const b = entry.clone(); // optimized
  for (const c of [a, b]) {
    c.mem.write8(BOARD, board);
    c.mem.write8(ARM_MARKER, ARM_SENTINEL);
  }
  const cA0 = a.cycles, cB0 = b.cycles;
  translated_03fb(a);
  optimized_03fb(b);
  const dA = a.cycles - cA0, dB = b.cycles - cB0;

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  const regs = firstRegDiff(a.regs, b.regs);
  return { ram, regs, pcEq: a.pc === b.pc, dA, dB, marker: a.mem.read8(ARM_MARKER) };
}

test("BRANCH (unit): BOARD != 2 (jp nz taken) — tail-only arm EQUAL (RAM+regs+pc+cycles)", () => {
  const r = diffBranch(captureEntry(), 0x01);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)} (${r.ram.a} vs ${r.ram.b})` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.ok(r.pcEq, "pc must match");
  assert.equal(r.dA, r.dB, `cycle-total mismatch (translated ${r.dA} vs optimized ${r.dB})`);
  // jp nz arm: entry_03fb writes NOTHING here, so the 0x63b7 sentinel survives.
  assert.equal(r.marker, ARM_SENTINEL, "!= 2 arm must NOT write 0x63b7 (jp nz taken before the prologue)");
  console.log(`  BRANCH/!=2: jp nz arm EQUAL, 0x63b7 untouched, cycles match (${r.dA} t)`);
});

test("BRANCH (unit): BOARD == 2 (fall-through, COLD) — rst 0x38 + 0x63b7 arm EQUAL (RAM+regs+pc+cycles)", () => {
  const r = diffBranch(captureEntry(), 0x02);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)} (${r.ram.a} vs ${r.ram.b})` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.ok(r.pcEq, "pc must match");
  assert.equal(r.dA, r.dB, `cycle-total mismatch (translated ${r.dA} vs optimized ${r.dB})`);
  // == 2 arm: the fall-through prologue overwrites the 0x63b7 sentinel (its signature).
  assert.notEqual(r.marker, ARM_SENTINEL, "== 2 arm must write 0x63b7 (ld (0x63b7),a in the prologue)");
  console.log(`  BRANCH/==2: COLD fall-through arm EQUAL, 0x63b7 rewritten to 0x${r.marker.toString(16)}, cycles match (${r.dA} t)`);
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_03fb]]), { scenario: CONVERGENT_SCENARIO });

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

test("TEETH (unit): a wrong colour-RAM store is CAUGHT and names 0x75C4", () => {
  const r = unitEquivalence(makeMachine, TARGET, translated_03fb, broken_03fb, { maxFrames: MAX_FRAMES });

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
