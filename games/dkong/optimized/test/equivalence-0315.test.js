// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for sub_0315 (the blinking player-up "1UP"/"2UP"
 * indicator, redrawn every 16th frame from the main loop). It is NOT a dispatch
 * target: mainLoop reaches it directly via `m.call(0x0315)` once per pass, so the
 * override is wired at CONSTRUCTION (both the whole-machine gate and the core unit
 * gate install it that way) and fires ~140x/frame.
 *
 * COLLAPSED (one m.step per basic block) and genuinely INTERRUPTIBLE (the vblank NMI
 * lands inside it in real gameplay -- see the ATOMIC note in optimized/sub_0315.js), so
 * per the lead's collapse-sweep rule the whole-machine gate is the CONVERGENT one
 * UNCONDITIONALLY, using SCENARIOS.gameplay (this routine's VRAM-writing branches need
 * an active credited game, not just attract). The convergent teeth is a CYCLE-DROP twin,
 * never a value-corruption twin over a long run (it can hang the game) -- that coverage
 * stays at the unit level.
 *
 * Six jobs (the four core gates + two branch-coverage sweeps):
 *
 *   1. EQUAL -- the idiomatic optimized sub_0315 CONVERGES against its translated
 *      oracle whole-machine (SCENARIOS.gameplay), and matches EQUAL at the unit level.
 *
 *   2. DISPATCH -- the override must actually fire, or EQUAL is vacuous. sub_0315 is
 *      m.call'd every main-loop pass from boot, so it fires thousands of times even
 *      in a short attract window.
 *
 *   3. TEETH -- a deliberately-broken twin (the first store to the P1 indicator cell
 *      0x7740 lands the wrong value) must be CAUGHT: NOT-EQUAL, naming 0x7740.
 *
 *   4. BRANCH COVERAGE -- sub_0315 has four data-dependent branches -> five arms:
 *        A  ret nz            (frame low-nibble != 0)                  -- attract + game
 *        B  rst-skip          (16th frame, ATTRACT bit0 set: sub_0008 -> false)
 *        C  bit4 clear        (blink phase 0: lit glyphs, loc_033e tail)
 *        D  bit4 set, 1-player (blank glyphs, `ret z` on TWO_PLAYER_GAME==0)
 *        E  bit4 set, 2-player (also repaints the OTHER player's column)
 *      Reached NATURALLY (proven by the whole-machine gates): A, B (plain boot's
 *      extended attract), C and D (a coin+start credits a game at ~f13, so both
 *      blink phases run over f4..f130). E needs a 2-player game and is NOT reached,
 *      so it is SYNTHESISED. For belt-and-suspenders teeth every arm A-E is
 *      synthesised from a captured entry and diffed (RAM+regs+pc AND cycle total --
 *      this routine is kept PER-INSTRUCTION, so a wrong charge on an arm no frame
 *      reaches would otherwise have no teeth).
 *
 * WHY PER-INSTRUCTION (no cycle collapse). The vblank NMI lands INSIDE this routine
 * on real gameplay -- 0x0315/0x0318/0x0319/0x031B are among the most-hit NMI-landing
 * addresses (doc 06). It runs from the main loop with the NMI mask ENABLED, so a
 * frame boundary routinely falls mid-routine; collapsing the m.step charges would
 * move where the NMI lands and change the PC it pushes into diffed stack RAM (the
 * loc_197a / entry_0611 mechanism). So the charges stay byte-identical to the oracle.
 *
 * WHY THE CORE ENGINE + A CUSTOM FACTORY (not harness.js's wrappers). Same reason as
 * loc_197a: to attach a coin+start inputTape identically to both sides. The factory
 * is shared, so any input is applied identically to baseline and optimized.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_0315 as translated_0315 } from "../../translated/mainloop.js";
import { sub_0315 as optimized_0315 } from "../sub_0315.js";
import { Machine } from "../../machine.js";
import { convergentGate, SCENARIOS } from "./convergent.js";
import {
  unitEquivalence,
  firstStateDiff,
  firstRegDiff,
} from "../../../../core/equivalence.js";
import { FRAME, CURRENT_PLAYER, TWO_PLAYER_GAME } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0315;

// The P1 indicator's top cell, written by every body run (arm C: value player+1;
// arm D/E: value 0x10). Inside the compared video-RAM dump (0x7400-0x77FF), and
// sub_0315 is its only writer during a credited game, so a corruption persists.
const BROKEN_ADDR = 0x7740;

// makeMachine factory for the UNIT-level tests below (crafted entries; the
// whole-machine gate now runs through convergentGate/SCENARIOS instead).
function makeFactory(tape) {
  return (overrides) => {
    const m = new Machine(ROM, overrides ? { overrides } : {});
    if (tape) m.inputTape = tape.map((t) => ({ ...t }));
    return m;
  };
}
const plainBoot = makeFactory(null);

/**
 * Deliberately-broken twin: behaviourally optimized_0315 EXCEPT the first store to
 * 0x7740 lands a wrong value (the correct byte XOR 0xFF). Intercepting exactly that
 * one write lets the rest of the routine and its callees run verbatim -- the
 * representative "wrong value to one of the routine's own output cells" bug.
 */
function broken_0315(m) {
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
    return optimized_0315(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

// -- EQUAL --------------------------------------------------------------------

// Per the lead's rule the whole-machine gate is the CONVERGENT one UNCONDITIONALLY.
// sub_0315 is genuinely interruptible, so SCENARIOS.gameplay (coin+start+movement) is
// used -- it also exercises the VRAM-writing blink-phase branches (C/D), same territory
// the old plain+coin-start pair covered, now under a gate tolerant of benign tears.
test("CONVERGENT (whole-machine): collapsed sub_0315 CONVERGES vs translated", () => {
  const r = convergentGate(new Map([[TARGET, optimized_0315]]), { scenario: SCENARIOS.gameplay });

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

test("EQUAL (unit): optimized sub_0315 matches translated in RAM + registers", () => {
  const r = unitEquivalence(plainBoot, TARGET, translated_0315, optimized_0315, { maxFrames: 20 });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical (first entry, ~frame 4)");
});

// -- TEETH --------------------------------------------------------------------

/**
 * CYCLE-DROP twin for the CONVERGENT gate: identical memory/registers to the collapsed
 * routine, but the frame-gate block charge is 5 t short. A wrong total forks the main
 * loop's spin count (0x6019 PRNG entropy) -- a PERSISTENT divergence, never a heal.
 */
function cyclebroken_0315(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(FRAME);
  regs.b = regs.a;
  regs.and(0x0f);
  m.step(0x031b, 19); // DROPPED: the correct charge here is 24 t
  if (regs.fNZ) { m.ret(11); return; }
  m.push16(0x031d);
  m.step(0x0008, 16);
  if (!m.call(0x0008)) return;
  regs.a = mem.read8(CURRENT_PLAYER);
  m.push16(0x0323);
  m.step(0x0347, 30);
  m.call(0x0347);
  regs.de = 0xffe0;
  const phaseSet = regs.bit(4, regs.b);
  m.step(0x0328, 18);
  if (phaseSet) {
    regs.a = 0x10;
    mem.write8(regs.hl, regs.a);
    regs.addHl(regs.de);
    mem.write8(regs.hl, regs.a);
    regs.addHl(regs.de);
    mem.write8(regs.hl, regs.a);
    m.step(0x0331, 57);
    regs.a = mem.read8(TWO_PLAYER_GAME);
    regs.and(regs.a);
    m.step(0x0335, 17);
    if (regs.fZ) { m.ret(11); return; }
    regs.a = mem.read8(CURRENT_PLAYER);
    regs.xor(0x01);
    m.push16(0x033e);
    m.step(0x0347, 42);
    m.call(0x0347);
  } else {
    m.step(0x033e, 12);
  }
  regs.a = regs.inc8(regs.a);
  mem.write8(regs.hl, regs.a);
  regs.addHl(regs.de);
  mem.write8(regs.hl, 0x25);
  regs.addHl(regs.de);
  mem.write8(regs.hl, 0x20);
  m.step(0x0346, 53);
  m.ret();
}

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_0315]]), { scenario: SCENARIOS.gameplay });

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

// Capture the pristine entry state of the FIRST body-writing dispatch -- a frame
// where the routine actually stores to VRAM (16th frame AND a game credited, so
// the rst-0x08 gate does not skip). Under plain boot that is frame 4 (arm C).
function captureBodyEntry() {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null &&
        (mm.mem.read8(0x601a) & 0x0f) === 0 &&
        (mm.mem.read8(0x6007) & 0x01) === 0) {
      entry = mm.clone(); // this dispatch will run the body and store to VRAM
    }
    return translated_0315(mm);
  }]]);
  const host = plainBoot(snap);
  host.runFrames(20);
  if (entry === null) throw new Error("sub_0315 never reached a body-writing dispatch");
  return entry;
}

test("TEETH (unit): a wrong indicator store is CAUGHT and names 0x7740", () => {
  const entry = captureBodyEntry();
  const a = entry.clone(); // translated
  const b = entry.clone(); // broken-optimized

  translated_0315(a);
  broken_0315(b);

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.ok(ram != null, "a caught divergence must name a RAM address");
  assert.equal(
    ram.addr,
    BROKEN_ADDR,
    `expected first diff at the broken address 0x${BROKEN_ADDR.toString(16)}, got 0x${ram.addr.toString(16)}`,
  );
  console.log(`  TEETH/unit: caught at 0x${ram.addr.toString(16)} (translated ${ram.a} vs broken ${ram.b})`);
});

// -- BRANCH COVERAGE ----------------------------------------------------------

// Capture any pristine sub_0315 entry to use as a clone base for synthesis. The
// entry's registers are all overwritten by the routine (A is reloaded from FRAME
// first), so only its RAM + SP matter -- and we set the deciding RAM per arm.
function captureAnyEntry() {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_0315(mm);
  }]]);
  const host = plainBoot(snap);
  host.runFrames(20);
  if (entry === null) throw new Error("sub_0315 never entered");
  return entry;
}

// Run oracle vs optimized on two clones of `entry` after applying `mutate` to both,
// and diff RAM + regs + pc + cycle total.
function diffArm(entry, mutate) {
  const a = entry.clone();
  const b = entry.clone();
  mutate(a);
  mutate(b);
  const cA0 = a.cycles, cB0 = b.cycles;
  translated_0315(a);
  optimized_0315(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  const regs = firstRegDiff(a.regs, b.regs);
  return { ram, regs, pcEq: a.pc === b.pc, dA: a.cycles - cA0, dB: b.cycles - cB0 };
}

const ARMS = [
  // name, mutate(m), sanity(a) -- a check that the intended arm really ran
  ["A ret-nz", (m) => { m.mem.write8(0x601a, 0x07); }, null],
  ["B rst-skip", (m) => { m.mem.write8(0x601a, 0x00); m.mem.write8(0x6007, 0x01); }, null],
  ["C bit4-clear (phase 0)", (m) => {
    m.mem.write8(0x601a, 0x00); m.mem.write8(0x6007, 0x00);
    m.mem.write8(0x600d, 0x00); m.mem.write8(0x600f, 0x00);
  }, (a) => assert.equal(a.mem.read8(0x7740), 0x01, "arm C must write the lit '1' glyph to 0x7740")],
  ["D bit4-set 1P (phase 1)", (m) => {
    m.mem.write8(0x601a, 0xf0); m.mem.write8(0x6007, 0x00);
    m.mem.write8(0x600d, 0x00); m.mem.write8(0x600f, 0x00);
  }, (a) => assert.equal(a.mem.read8(0x7740), 0x10, "arm D must write the blank glyph 0x10 to 0x7740")],
  ["E bit4-set 2P (both columns)", (m) => {
    m.mem.write8(0x601a, 0xf0); m.mem.write8(0x6007, 0x00);
    m.mem.write8(0x600d, 0x00); m.mem.write8(0x600f, 0x01);
  }, (a) => {
    assert.equal(a.mem.read8(0x7740), 0x10, "arm E must blank the P1 column at 0x7740");
    assert.equal(a.mem.read8(0x74e0), 0x02, "arm E must draw the '2' digit in the P2 column at 0x74E0");
  }],
];

test("BRANCH COVERAGE: all five arms A-E are EQUAL (RAM+regs+pc+cycles), incl. the un-reached 2P arm", () => {
  const entry = captureAnyEntry();
  for (const [name, mutate, sanity] of ARMS) {
    const r = diffArm(entry, mutate);
    assert.equal(r.ram, null, r.ram ? `${name}: RAM diff at 0x${r.ram.addr.toString(16)} (${r.ram.a} vs ${r.ram.b})` : "");
    assert.equal(r.regs, null, r.regs ? `${name}: reg diff at ${r.regs.reg} (${r.regs.a} vs ${r.regs.b})` : "");
    assert.ok(r.pcEq, `${name}: pc mismatch`);
    assert.equal(r.dA, r.dB, `${name}: cycle-total mismatch (translated ${r.dA} vs optimized ${r.dB})`);
    if (sanity) {
      // Re-run the oracle once to assert the intended arm actually executed.
      const a = entry.clone();
      mutate(a);
      translated_0315(a);
      sanity(a);
    }
  }
  console.log("  BRANCH COVERAGE: A ret-nz / B rst-skip / C phase-0 / D phase-1-1P / E phase-1-2P all EQUAL (RAM+regs+pc+cycles)");
});
