// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for sub_1486 (the on-board BONUS-ITEM mover + value-digit
 * display -- GAME_SUBSTATE(0x600A) phase 21). It is dispatched from INSIDE the vblank
 * NMI: while a credited game is in phase 21 (GAME_STATE 0x6005 == 3, GAME_SUBSTATE
 * 0x600A == 0x15), dispatchGameState vectors to loc_06fe, whose 0x0702 rst-0x28 table
 * lands on sub_1486 at index 21. It is the LARGEST routine in the sweep (ROM 0x1486-
 * 0x15F9, 372 bytes, an irreducible label-dispatch CFG with a single ret at 0x15F9).
 *
 * Jobs:
 *   1. CONVERGENT (whole-machine) -- the collapsed optimized sub_1486 CONVERGES
 *      against its translated oracle under a whole-machine run (pixels + persistent
 *      non-stack state). Driven by a coin+start inputTape (credits + starts a game)
 *      PLUS an identical-both-sides poke that forces phase 21 from frame 70; it then
 *      dispatches ~131x over the window, walking the item across the board through
 *      many position-index / display-timer / sprite-animate branches. sub_1486 IS
 *      atomic (see optimized/sub_1486.js) so the collapse is byte-exact and trivially
 *      converges -- but per the lead's unconditional rule, any routine with a
 *      whole-machine test runs it under the convergent gate regardless.
 *   2. EQUAL (unit) -- EQUAL in RAM + every register (F, A, SP, IX, IY included) + pc.
 *   3/4. TEETH (convergent + unit) -- convergent: a CYCLE-DROP twin (one charge short
 *      on the routine's own prologue block, hit on EVERY dispatch) forks the main-loop
 *      spin count (0x6019 PRNG entropy), a PERSISTENT divergence, CAUGHT. unit: a
 *      deliberately-broken twin lands a wrong value at the value-digit cell 0x7572 (a
 *      pure display cell in the compared VRAM dump, written on a display-timer wrap; no
 *      control-flow effect) and is CAUGHT, naming 0x7572. The teeth poke additionally
 *      holds the display timer at 1 so EVERY dispatch wraps and writes 0x7572 --
 *      including the first captured unit entry.
 *   5. BRANCH COVERAGE -- sub_1486's data-dependent arms are each synthesised from a
 *      real captured entry (main-loop arms from a post-INIT seed, so the item-slot
 *      pointers 0x6038/0x603A are valid) and proven EQUAL (RAM + all registers + pc)
 *      AND carrying the oracle's exact cycle total: INIT, timer-no-wrap, timer-wrap,
 *      value==0 EXIT, position column-walk (bit7) + its 0x1C / 0x1D arms, position
 *      low-bits inc / dec / divider-hold, and sprite-animate toggle-set / toggle-clear.
 *      Their distinct cycle totals are themselves proof the arms take distinct paths.
 *   6. WRITE-TRACE -- sub_1486's INIT branch makes two HARDWARE writes (the palette-bank
 *      latches 0x7D86/0x7D87). UNLIKE loc_0a8a's, the ORACLE leaves them UNTAGGED (no
 *      write-bus-cycle offset), so under the emit `--writes` trace BOTH the oracle and
 *      the optimized routine THROW identically (memory.js refuses an untagged hardware
 *      write) -- the optimized reproduces that exactly. Teeth: a busOffset-TAGGED variant
 *      does NOT throw (it records the two writes), so it is distinguishable -- proving
 *      the optimized did not silently "fix" the oracle's untagged writes (which would be
 *      a divergence under a trace).
 *
 * CYCLE DECISION -- COLLAPSED to one m.step per basic block (see optimized/sub_1486.js).
 * sub_1486 IS atomic in the usual sense (it runs inside the vblank NMI, entered
 * mask-cleared, so no second NMI lands inside it or its callees), so the collapse is
 * byte-identical to the oracle at every surviving m.step boundary -- confirmed by the
 * unit/branch-arm tests below, which are UNCHANGED and still pass byte-exact. Per the
 * lead's unconditional rule, the WHOLE-MACHINE job nonetheless runs under the CONVERGENT
 * gate (not the strict one) regardless of atomicity -- harmless here since a byte-exact
 * collapse trivially converges (0 tear frames, 0 persistent state expected).
 *
 * WHY THE CORE ENGINE + A CUSTOM FACTORY (not harness.js's wrappers). harness.js bakes a
 * `makeMachine` on `{}` assets that drives no input and applies no poke, so it never
 * reaches a credited game's phase 21 and never dispatches sub_1486. This test therefore
 * calls the SAME core unitEquivalence / wholeMachineEquivalence directly, passing a
 * factory that adds an identical coin+start inputTape AND an identical phase-21 poke to
 * BOTH sides (the snapshot override is still installed at CONSTRUCTION, which is what
 * reaches sub_1486 however it is entered). Same pattern as equivalence-1839/0a76/06fe.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_1486 as translated_1486 } from "../../translated/state0.js";
import { sub_1486 as optimized_1486 } from "../sub_1486.js";
import { Machine } from "../../machine.js";
import { convergentGate } from "./convergent.js";
import { SUBSTATE_TIMER, P1_INPUT } from "../ram.js";
import {
  unitEquivalence,
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

const TARGET = 0x1486;
const FRAMES = 200; // phase 21 forced from frame 70; ~131 dispatches across the window
const MAX_FRAMES = 120; // sub_1486 first dispatches at frame 70

// Credit + start a game (identical to loc_1839/0a76's tape).
const COIN_START_TAPE = [
  { port: 0x7d00, bits: 0x80, frame: 10, dur: 6 }, // coin  (IN2 bit7)
  { port: 0x7d00, bits: 0x04, frame: 30, dur: 6 }, // start (IN2 bit2)
];

// Force phase 21: hold GAME_STATE(0x6005)=3 (in-game) and GAME_SUBSTATE(0x600A)=0x15
// (sub_1486) from frame 70. Applied by the SHARED factory, so both sides see it.
const PHASE21_POKE = [
  { addr: 0x6005, val: 0x03, frame: 70, dur: null },
  { addr: 0x600a, val: 0x15, frame: 70, dur: null },
];

// Teeth poke: phase 21 PLUS the display timer held at 1, so EVERY dispatch wraps and
// writes the value-digit cells -- so the very first captured unit entry writes 0x7572.
const TEETH_POKE = [
  { addr: 0x6005, val: 0x03, frame: 70, dur: null },
  { addr: 0x600a, val: 0x15, frame: 70, dur: null },
  { addr: 0x6034, val: 0x01, frame: 70, dur: null }, // display timer -> wrap every frame
];

function makeFactory(poke) {
  return (overrides) => {
    const m = new Machine(ROM, overrides ? { overrides } : {});
    m.inputTape = COIN_START_TAPE.map((t) => ({ ...t }));
    m.pokes = poke.map((p) => ({ ...p }));
    return m;
  };
}

// A custom convergentGate scenario (not one of convergent.js's generic SCENARIOS):
// the SAME coin+start tape + phase-21 poke as above, so the whole-machine convergent
// run actually reaches sub_1486's dispatch (convergentGate's own factory adds the gfx
// assets + captureVideo pixels-are-ground-truth requirement on top).
const PHASE21_SCENARIO = {
  frames: FRAMES,
  inputs: COIN_START_TAPE,
  pokes: PHASE21_POKE,
};
const makeMachine = makeFactory(PHASE21_POKE);
const makeTeethMachine = makeFactory(TEETH_POKE);

// sub_1486's value-digit tens cell (VRAM, in the compared 0x7400-0x77FF dump), written
// once per display-timer wrap with no same-frame overwrite -- a pure display cell, so a
// wrong value gives a clean diff and never steers dispatch into a stub.
const BROKEN_ADDR = 0x7572;

// The two-bit palette-bank latch (same private constants as sub_1486.js -- not
// exported, so this from-scratch cycle-broken twin needs its own copies).
const PALETTE_BANK_LO = 0x7d86;
const PALETTE_BANK_HI = 0x7d87;

/**
 * Cycle-broken twin for the CONVERGENT gate: a full copy of the collapsed sub_1486
 * EXCEPT its very first block (the mode-latch prologue, hit on EVERY dispatch) is 5 t
 * short (16 instead of 21). A wrong total forks the main-loop spin count (0x6019 PRNG
 * entropy) -- a PERSISTENT divergence, never a heal. This is the teeth for the
 * collapse's load-bearing invariant (total-cycle preservation).
 */
function cyclebroken_1486(m) {
  const { regs, mem } = m;
  let label = 0x1486;
  for (;;) {
    switch (label) {
      case 0x1486:
        m.push16(0x1489);
        m.step(0x0616, 17);
        m.call(0x0616);
        regs.hl = SUBSTATE_TIMER;
        regs.a = mem.read8(regs.hl);
        regs.and(regs.a);
        m.step(0x148e, 16); // DROPPED: correct total is 21 t
        if (regs.fNZ) { label = 0x14dc; continue; }
        m.step(0x1491, 10);
        mem.write8(PALETTE_BANK_LO, regs.a);
        m.step(0x1494, 13);
        mem.write8(PALETTE_BANK_HI, regs.a);
        m.step(0x1497, 13);
        mem.write8(regs.hl, 0x01);
        regs.hl = 0x6030;
        mem.write8(regs.hl, 0x0a);
        regs.hl = (regs.hl + 1) & 0xffff;
        mem.write8(regs.hl, 0x00);
        regs.hl = (regs.hl + 1) & 0xffff;
        mem.write8(regs.hl, 0x10);
        regs.hl = (regs.hl + 1) & 0xffff;
        mem.write8(regs.hl, 0x1e);
        regs.hl = (regs.hl + 1) & 0xffff;
        mem.write8(regs.hl, 0x3e);
        regs.hl = (regs.hl + 1) & 0xffff;
        mem.write8(regs.hl, 0x00);
        regs.hl = 0x75e8;
        mem.write16(0x6036, regs.hl);
        regs.hl = 0x611c;
        regs.a = mem.read8(0x600e);
        regs.rlca();
        regs.a = regs.inc8(regs.a);
        regs.c = regs.a;
        regs.de = 0x0022;
        regs.b = 0x04;
        m.step(0x14c1, 188);
      case 0x14c1:
        regs.a = mem.read8(regs.hl);
        regs.cp(regs.c);
        if (regs.fZ) { label = 0x14c9; continue; }
        regs.addHl(regs.de);
        m.step(0x14c7, 32);
        regs.djnz();
        m.step(regs.b ? 0x14c1 : 0x14c9, regs.b ? 13 : 8);
        if (regs.b) { label = 0x14c1; continue; }
      case 0x14c9:
        mem.write16(0x6038, regs.hl);
        regs.de = 0xfff3;
        regs.addHl(regs.de);
        mem.write16(0x603a, regs.hl);
        regs.b = 0x00;
        regs.a = mem.read8(0x6035);
        regs.c = regs.a;
        m.push16(0x14dc);
        m.step(0x15fa, 94);
        m.call(0x15fa);
      case 0x14dc:
        regs.hl = 0x6034;
        regs.decMem8(mem, regs.hl);
        m.step(0x14e0, 21);
        if (regs.fNZ) { label = 0x14fc; continue; }
        mem.write8(regs.hl, 0x3e);
        regs.hl = (regs.hl - 1) & 0xffff;
        regs.decMem8(mem, regs.hl);
        m.step(0x14e7, 37);
        if (regs.fZ) { label = 0x15c6; continue; }
        regs.a = mem.read8(regs.hl);
        regs.b = 0xff;
        m.step(0x14ed, 24);
      case 0x14ed:
        regs.b = regs.inc8(regs.b);
        regs.sub(0x0a);
        m.step(0x14f0, 11);
        if (regs.fNC) { label = 0x14ed; continue; }
        regs.add(0x0a);
        mem.write8(0x7552, regs.a);
        regs.a = regs.b;
        mem.write8(0x7572, regs.a);
        m.step(0x14fc, 47);
      case 0x14fc:
        regs.hl = 0x6030;
        regs.b = mem.read8(regs.hl);
        mem.write8(regs.hl, 0x0a);
        regs.a = mem.read8(P1_INPUT);
        regs.bit(7, regs.a);
        m.step(0x1507, 48);
        if (regs.fNZ) { label = 0x1546; continue; }
        regs.and(0x03);
        m.step(0x150c, 17);
        if (regs.fNZ) { label = 0x1514; continue; }
        regs.a = regs.inc8(regs.a);
        mem.write8(regs.hl, regs.a);
        m.step(0x1511, 21);
        label = 0x158a;
        continue;
      case 0x1514:
        regs.b = regs.dec8(regs.b);
        m.step(0x1515, 4);
        if (regs.fZ) { label = 0x151d; continue; }
        regs.a = regs.b;
        mem.write8(regs.hl, regs.a);
        m.step(0x151a, 21);
        label = 0x158a;
        continue;
      case 0x151d:
        regs.bit(1, regs.a);
        m.step(0x151f, 8);
        if (regs.fNZ) { label = 0x1539; continue; }
        regs.a = mem.read8(0x6035);
        regs.a = regs.inc8(regs.a);
        regs.cp(0x1e);
        m.step(0x1528, 34);
        if (regs.fNZ) { label = 0x152d; continue; }
        regs.a = 0x00;
        m.step(0x152d, 17);
      case 0x152d:
        mem.write8(0x6035, regs.a);
        regs.c = regs.a;
        regs.b = 0x00;
        m.push16(0x1536);
        m.step(0x15fa, 41);
        m.call(0x15fa);
        label = 0x158a;
        continue;
      case 0x1539:
        regs.a = mem.read8(0x6035);
        regs.sub(0x01);
        m.step(0x153e, 20);
        if (regs.fP) { label = 0x152d; continue; }
        regs.a = 0x1d;
        m.step(0x1543, 17);
        label = 0x152d;
        continue;
      case 0x1546:
        regs.a = mem.read8(0x6035);
        regs.cp(0x1c);
        m.step(0x154b, 20);
        if (regs.fZ) { label = 0x156d; continue; }
        regs.cp(0x1d);
        m.step(0x1550, 17);
        if (regs.fZ) { label = 0x15c6; continue; }
        regs.hl = mem.read16(0x6036);
        regs.bc = 0x7588;
        regs.and(regs.a);
        regs.sbcHl(regs.bc);
        m.step(0x155c, 55);
        if (regs.fZ) { label = 0x158a; continue; }
        regs.addHl(regs.bc);
        regs.add(0x11);
        mem.write8(regs.hl, regs.a);
        regs.bc = 0xffe0;
        regs.addHl(regs.bc);
        m.step(0x1567, 56);
      case 0x1567:
        mem.write16(0x6036, regs.hl);
        m.step(0x156a, 16);
        label = 0x158a;
        continue;
      case 0x156d:
        regs.hl = mem.read16(0x6036);
        regs.bc = 0x0020;
        regs.addHl(regs.bc);
        regs.and(regs.a);
        regs.bc = 0x7608;
        regs.sbcHl(regs.bc);
        m.step(0x157a, 66);
        if (regs.fNZ) { label = 0x1586; continue; }
        regs.hl = 0x75e8;
        m.step(0x1580, 20);
      case 0x1580:
        regs.a = 0x10;
        mem.write8(regs.hl, regs.a);
        m.step(0x1583, 14);
        label = 0x1567;
        continue;
      case 0x1586:
        regs.addHl(regs.bc);
        m.step(0x1587, 11);
        label = 0x1580;
        continue;
      case 0x158a:
        regs.hl = 0x6032;
        regs.decMem8(mem, regs.hl);
        m.step(0x158e, 21);
        if (regs.fNZ) { label = 0x15f9; continue; }
        regs.a = mem.read8(0x6031);
        regs.and(regs.a);
        m.step(0x1595, 27);
        if (regs.fNZ) { label = 0x15b8; continue; }
        regs.a = 0x01;
        mem.write8(0x6031, regs.a);
        regs.de = 0x01bf;
        m.step(0x15a0, 40);
      case 0x15a0:
        regs.iy = mem.read16(0x6038);
        regs.l = mem.read8((regs.iy + 0x04) & 0xffff);
        regs.h = mem.read8((regs.iy + 0x05) & 0xffff);
        m.push16(regs.hl);
        regs.ix = m.pop16();
        m.push16(0x15b0);
        m.step(0x057c, 100);
        m.call(0x057c);
        regs.a = 0x10;
        mem.write8(0x6032, regs.a);
        m.step(0x15b5, 20);
        label = 0x15f9;
        continue;
      case 0x15b8:
        regs.xor(regs.a);
        mem.write8(0x6031, regs.a);
        regs.de = mem.read16(0x6038);
        regs.de = (regs.de + 1) & 0xffff;
        regs.de = (regs.de + 1) & 0xffff;
        regs.de = (regs.de + 1) & 0xffff;
        m.step(0x15c3, 55);
        label = 0x15a0;
        continue;
      case 0x15c6:
        regs.de = mem.read16(0x6038);
        regs.xor(regs.a);
        mem.write8(regs.de, regs.a);
        regs.hl = SUBSTATE_TIMER;
        mem.write8(regs.hl, 0x80);
        regs.hl = (regs.hl + 1) & 0xffff;
        regs.decMem8(mem, regs.hl);
        regs.b = 0x0c;
        regs.hl = 0x75e8;
        regs.iy = mem.read16(0x603a);
        regs.de = 0xffe0;
        m.step(0x15df, 115);
      case 0x15df:
        regs.a = mem.read8(regs.hl);
        mem.write8((regs.iy + 0x00) & 0xffff, regs.a);
        regs.iy = (regs.iy + 1) & 0xffff;
        regs.addHl(regs.de);
        regs.djnz();
        if (regs.b) {
          m.step(0x15df, 60);
          label = 0x15df;
          continue;
        }
        regs.b = 0x05;
        regs.de = 0x0314;
        m.step(0x15ed, 72);
      case 0x15ed:
        m.push16(0x15f0);
        m.step(0x309f, 17);
        m.call(0x309f);
        regs.de = (regs.de + 1) & 0xffff;
        regs.djnz();
        if (regs.b) {
          m.step(0x15ed, 19);
          label = 0x15ed;
          continue;
        }
        regs.de = 0x031a;
        m.step(0x15f6, 24);
        m.push16(0x15f9);
        m.step(0x309f, 17);
        m.call(0x309f);
      case 0x15f9:
        m.ret(10);
        return;
      default:
        throw new Error(`cyclebroken_1486: unreachable label 0x${label.toString(16)}`);
    }
  }
}

/**
 * Deliberately-broken twin: behaviourally optimized_1486 EXCEPT the FIRST store to
 * 0x7572 lands a wrong value (the correct byte XOR 0xFF). Every other write and every
 * subroutine runs verbatim -- the representative "wrong value to one of the routine's
 * own output addresses" bug the gate must catch.
 */
function broken_1486(m) {
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
    return optimized_1486(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine): collapsed sub_1486 CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_1486]]), { scenario: PHASE21_SCENARIO });

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
    `  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x (phase 21, item walk across the board); ` +
      `${r.pixDiffFrames} tear frame(s) (max ${r.maxPixels}px, healed), ` +
      `non-stack state persistent = ${r.statePersistent.length}`,
  );
});

test("EQUAL (unit): idiomatic optimized sub_1486 matches translated in RAM + registers", () => {
  const r = unitEquivalence(makeMachine, TARGET, translated_1486, optimized_1486, { maxFrames: MAX_FRAMES });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F, A, SP, IX, IY) + pc identical (first entry frame 70)");
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_1486]]), { scenario: PHASE21_SCENARIO });

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

test("TEETH (unit): a wrong value-digit store is CAUGHT and names 0x7572", () => {
  const r = unitEquivalence(makeTeethMachine, TARGET, translated_1486, broken_1486, { maxFrames: MAX_FRAMES });

  assert.equal(r.equal, false, "harness FAILED to catch a wrong store — it is worthless");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  assert.equal(
    r.ram.addr,
    BROKEN_ADDR,
    `expected first diff at 0x${BROKEN_ADDR.toString(16)}, got 0x${r.ram.addr.toString(16)}`,
  );
  console.log(
    `  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`,
  );
});

// -- BRANCH COVERAGE (synthesised per-arm teeth incl. cycle totals) -----------

/**
 * Capture ONE real entry to sub_1486 (the first dispatch, frame 70) via the core unit
 * gate's construction-time snapshot override, so synthesised arms inherit a valid stack
 * and realistic RAM. The captured entry has SUBSTATE_TIMER(0x6009) != 0, i.e. the
 * MAIN-LOOP path (the item-slot pointers are NOT yet set on this raw entry).
 */
function captureEntry() {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_1486(mm); // let the host run proceed to a clean stop
  }]]);
  const host = makeMachine(snap);
  host.runFrames(MAX_FRAMES);
  if (entry === null) throw new Error(`sub_1486 never dispatched within ${MAX_FRAMES} frames`);
  return entry;
}

/**
 * A post-INIT seed: run the translated INIT branch once (SUBSTATE_TIMER := 0 forces it)
 * so the item-slot pointers 0x6038/0x603A hold valid WORK-RAM addresses. Main-loop and
 * EXIT arms synthesise from this seed, so their slot-clear / column-copy / render writes
 * land in RAM (a raw-entry EXIT would write through a null 0x6038 into ROM and throw --
 * on BOTH sides, so it is not a divergence, but it is not a useful EQUAL either).
 */
function postInitSeed(entry) {
  const s = entry.clone();
  s.mem.write8(0x6009, 0x00); // SUBSTATE_TIMER == 0 -> INIT branch
  translated_1486(s); // establishes 0x6038/0x603A + seeds the item-state block
  return s;
}

/** T-states a fn consumes on a fresh clone (clone() neutralises the frame machinery). */
function cyclesOf(seed, fn) {
  const c = seed.clone();
  const before = c.cycles;
  fn(c);
  return c.cycles - before;
}

/**
 * Prove one arm EQUAL. Poke the deciding RAM on a clone of `seed`, run oracle vs
 * optimized on two further clones, and assert RAM + every register + pc identical, and
 * the SAME (nonzero) cycle total on both sides. The arms' distinct totals are what make
 * the coverage non-vacuous -- a wrong path would consume a different number of T-states.
 * `check` optionally asserts a distinctive post-condition on the oracle's result.
 */
function proveArm(seed, name, setup, check) {
  const s = seed.clone();
  setup(s);

  const a = s.clone(); // translated oracle
  const b = s.clone(); // optimized
  translated_1486(a);
  optimized_1486(b);

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  const regs = firstRegDiff(a.regs, b.regs);
  assert.equal(ram, null, ram ? `${name}: RAM diff at 0x${ram.addr.toString(16)} (${ram.a} vs ${ram.b})` : "");
  assert.equal(regs, null, regs ? `${name}: reg diff at ${regs.reg} (${regs.a} vs ${regs.b})` : "");
  assert.equal(a.pc, b.pc, `${name}: pc must match`);

  const cycT = cyclesOf(s, translated_1486);
  const cycO = cyclesOf(s, optimized_1486);
  assert.ok(cycT > 0, `${name}: oracle must consume cycles`);
  assert.equal(cycO, cycT, `${name}: cycle total ${cycO} != oracle ${cycT}`);

  if (check) check(a, name);
  console.log(`  ARM ${name}: EQUAL (RAM+regs+pc); cycle total ${cycO}`);
}

const rd = (m, addr) => m.mem.read8(addr);

test("BRANCH COVERAGE: INIT + main-loop timer arms + EXIT dispatch EQUAL (RAM + regs + pc + cycle)", () => {
  const entry = captureEntry();
  const seed = postInitSeed(entry);

  // INIT (SUBSTATE_TIMER == 0): clears the palette latches, seeds the item-state block,
  // scans 0x611C for the slot, renders (sub_15fa) and falls into the main loop. From the
  // RAW entry (before INIT ran). Post-condition: SUBSTATE_TIMER := 1 (running).
  proveArm(entry, "INIT (0x6009==0)",
    (s) => { s.mem.write8(0x6009, 0x00); },
    (a, name) => assert.equal(rd(a, 0x6009), 0x01, `${name}: expected SUBSTATE_TIMER := 1 (running)`));

  // timer NO-wrap: display timer still counting -> value untouched, jump to stage 2.
  proveArm(seed, "timer no-wrap (0x6034=0x3e)",
    (s) => { s.mem.write8(0x6034, 0x3e); },
    (a, name) => assert.equal(rd(a, 0x6034), 0x3d, `${name}: expected display timer decremented 0x3e->0x3d, not reloaded`));

  // timer WRAP, value > 0: reload 0x3E, value 5->4, BCD-split to 0x7552/0x7572.
  proveArm(seed, "timer wrap value>0 (0x6034=1,0x6033=5)",
    (s) => { s.mem.write8(0x6034, 0x01); s.mem.write8(0x6033, 0x05); },
    (a, name) => {
      assert.equal(rd(a, 0x6034), 0x3e, `${name}: expected display timer reloaded to 0x3E`);
      assert.equal(rd(a, 0x6033), 0x04, `${name}: expected value decremented 5->4`);
    });

  // value == 0 -> EXIT / cleanup: SUBSTATE_TIMER := 0x80, dec GAME_SUBSTATE, task enqueue.
  proveArm(seed, "EXIT value==0 (0x6034=1,0x6033=1)",
    (s) => { s.mem.write8(0x6034, 0x01); s.mem.write8(0x6033, 0x01); },
    (a, name) => assert.equal(rd(a, 0x6009), 0x80, `${name}: expected SUBSTATE_TIMER := 0x80 (done)`));
});

test("BRANCH COVERAGE: position-step arms (bit7 column-walk + low-bits) dispatch EQUAL", () => {
  const entry = captureEntry();
  const seed = postInitSeed(entry);
  // Keep the display timer from wrapping so the position step is the branch under test.
  const holdTimer = (s) => s.mem.write8(0x6034, 0x3e);

  // P1_INPUT bit7 set -> the video-column walk (0x1546), index not at a sentinel.
  proveArm(seed, "bit7 column-walk (0x6010=0x80,0x6035=5)",
    (s) => { holdTimer(s); s.mem.write8(0x6010, 0x80); s.mem.write8(0x6035, 0x05); });
  // bit7 + index == 0x1C -> the 0x156D lower-sentinel arm.
  proveArm(seed, "bit7 index==0x1C (0x6035=0x1c)",
    (s) => { holdTimer(s); s.mem.write8(0x6010, 0x80); s.mem.write8(0x6035, 0x1c); });
  // bit7 + index == 0x1D -> EXIT via the column walk.
  proveArm(seed, "bit7 index==0x1D EXIT (0x6035=0x1d)",
    (s) => { holdTimer(s); s.mem.write8(0x6010, 0x80); s.mem.write8(0x6035, 0x1d); },
    (a, name) => assert.equal(rd(a, 0x6009), 0x80, `${name}: expected EXIT (SUBSTATE_TIMER := 0x80)`));

  // bit7 clear, low bits set, divider EXPIRES (0x6030=1 -> dec to 0): step the index.
  // bit1 clear -> increment path (0x152D); bit1 set -> signed decrement path (0x1539).
  proveArm(seed, "low-bits inc, divider expires (0x6010=1,0x6030=1)",
    (s) => { holdTimer(s); s.mem.write8(0x6010, 0x01); s.mem.write8(0x6030, 0x01); s.mem.write8(0x6035, 0x05); });
  proveArm(seed, "low-bits dec, divider expires (0x6010=2,0x6030=1)",
    (s) => { holdTimer(s); s.mem.write8(0x6010, 0x02); s.mem.write8(0x6030, 0x01); s.mem.write8(0x6035, 0x05); });
  // low bits set, divider does NOT expire (0x6030=5 -> dec to 4, stored, straight to animate).
  proveArm(seed, "low-bits divider hold (0x6010=1,0x6030=5)",
    (s) => { holdTimer(s); s.mem.write8(0x6010, 0x01); s.mem.write8(0x6030, 0x05); s.mem.write8(0x6035, 0x05); },
    (a, name) => assert.equal(rd(a, 0x6030), 0x04, `${name}: expected divider stored 5->4 (not expired)`));
});

test("BRANCH COVERAGE: sprite-animate arms (anim timer expires, toggle set/clear) dispatch EQUAL", () => {
  const entry = captureEntry();
  const seed = postInitSeed(entry);
  const holdTimer = (s) => s.mem.write8(0x6034, 0x3e);

  // Anim timer expires (0x6032=1 -> dec to 0). Toggle clear (0x6031=0) -> render via
  // 0x15A0 with DE=0x01BF; toggle set (0x6031=1) -> 0x15B8, toggle:=0, DE=(0x6038)+3.
  proveArm(seed, "anim expires, toggle clear (0x6032=1,0x6031=0)",
    (s) => { holdTimer(s); s.mem.write8(0x6032, 0x01); s.mem.write8(0x6031, 0x00); },
    (a, name) => assert.equal(rd(a, 0x6032), 0x10, `${name}: expected anim timer reloaded to 0x10`));
  proveArm(seed, "anim expires, toggle set (0x6032=1,0x6031=1)",
    (s) => { holdTimer(s); s.mem.write8(0x6032, 0x01); s.mem.write8(0x6031, 0x01); },
    (a, name) => assert.equal(rd(a, 0x6031), 0x00, `${name}: expected toggle cleared 1->0`));
});

// -- WRITE-TRACE (the INIT branch's UNTAGGED hardware writes) ------------------

/** Run `fn` on a clone forced into the INIT branch (SUBSTATE_TIMER := 0) with the
 * hardware write-trace recording; return either the recorded trace or the throw message. */
function initUnderTrace(seed, fn) {
  const c = seed.clone();
  c.mem.write8(0x6009, 0x00); // force the INIT branch
  c.mem.writeTrace = [];
  try {
    fn(c);
    return { threw: false, trace: c.mem.writeTrace.map((w) => ({ addr: w.addr, value: w.value })) };
  } catch (e) {
    return { threw: true, message: e.message };
  }
}

test("WRITE-TRACE: the INIT palette writes are UNTAGGED — oracle and optimized throw identically", () => {
  const entry = captureEntry();

  const oracle = initUnderTrace(entry, translated_1486);
  const opt = initUnderTrace(entry, optimized_1486);

  // The oracle leaves the two 0x7D86/0x7D87 writes untagged, so tracing them throws.
  assert.equal(oracle.threw, true, "oracle INIT should throw under writeTrace (untagged hardware write)");
  assert.match(oracle.message, /0x7d86 has no write-bus-cycle offset/, "oracle throw should name the untagged palette write");
  // The optimized routine reproduces that byte-for-byte: same throw, same message.
  assert.equal(opt.threw, true, "optimized INIT must reproduce the oracle's untagged-write throw");
  assert.equal(opt.message, oracle.message, "optimized throw message must match the oracle's exactly");

  // Teeth: a busOffset-TAGGED variant does NOT throw (it records the two palette writes),
  // so it is distinguishable -- proving the check would catch an optimized that silently
  // "fixed" the oracle's untagged writes (a divergence under a trace).
  const tagged = initUnderTrace(entry, (m) => {
    const { regs, mem } = m;
    regs.a = 0x00;
    mem.write8(0x7d86, regs.a, 10); // TAGGED: records instead of throwing
    mem.write8(0x7d87, regs.a, 10);
  });
  assert.equal(tagged.threw, false, "a tagged variant should not throw");
  assert.deepEqual(
    tagged.trace,
    [{ addr: 0x7d86, value: 0 }, { addr: 0x7d87, value: 0 }],
    "a tagged variant records the two palette-bank writes",
  );
  console.log("  WRITE-TRACE: oracle + optimized both throw on the untagged palette write; tagged variant distinguishable");
});
