// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests.
 *
 * handler_01c3 is now COLLAPSED (one m.step per straight-line run between calls;
 * see the routine's own docstring). Per the fleet-wide rule: "atomic" is a property
 * of the SCENARIO exercised, not of the routine (sub_0350 is byte-identical under
 * attract but tears under gameplay) -- so the whole-machine gate uses the
 * CONVERGENT license UNCONDITIONALLY here, even though this routine's collapse
 * happens to still pass the strict byte-exact gate on every scenario tried.
 *
 * Three jobs:
 *
 *   1. CONVERGENT (whole-machine) — the collapsed optimized handler_01c3
 *      (optimized/handler_01c3.js) must CONVERGE against its translated oracle
 *      (pixels + persistent non-stack state) under a real run.
 *
 *   2. EQUAL (unit) — the collapsed routine must still be byte-identical at its
 *      own captured entry (RAM + all registers + pc): this routine runs once,
 *      early, at power-on, so the unit gate is a strong local check the
 *      convergent gate does not replace.
 *
 *   3. TEETH — a deliberately-broken twin (one store lands the wrong value, unit)
 *      and a CYCLE-DROP twin (a wrong cycle total, convergent) must both be
 *      CAUGHT. A gate that has never been seen to fail is not known to work.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine } from "../../machine.js";
import { handler_01c3 as translated_01c3 } from "../../translated/state0.js";
import { handler_01c3 as optimized_01c3 } from "../handler_01c3.js";
import { unitEquivalence } from "../harness.js";
import { convergentGate, SCENARIOS } from "./convergent.js";
import {
  ATTRACT, LEVEL, LIVES, GAME_STATE, BOARD, GAME_SUBSTATE,
} from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x01c3;
const FRAMES = 30; // handler_01c3 runs once, early; this covers it + downstream

/**
 * The deliberately-broken twin used for the TEETH tests: behaviourally the
 * optimized handler EXCEPT the store to 0x6229 lands 0x99 instead of the correct
 * 0x01. Implemented by intercepting exactly that one write, so the rest of the
 * routine and every subroutine it calls run verbatim — this is a "wrong value to
 * one of the routine's own addresses" bug, the representative failure the gate
 * must catch. (0x6229 is the level number; the game keeps running with the bad
 * value, so the divergence persists as level 0x99 vs 0x01 in the state trace
 * rather than crashing — a clean, observable catch.)
 */
function broken_01c3(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke && addr === 0x6229) {
      broke = true;
      return realWrite(addr, 0x99, busOffset);
    }
    return realWrite(addr, value, busOffset);
  };
  try {
    return optimized_01c3(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

// -- EQUAL --------------------------------------------------------------------

// Board control latch, not work RAM — it lives in the dkong board, not ram.js.
const FLIPSCREEN = 0x7d82;

// Cycle-broken twin for the CONVERGENT gate: identical memory + registers to the
// collapsed routine, but the first fold's total is 5 t short. A wrong total shifts
// the main loop's spin count (0x6019 PRNG entropy), forking the RANDOM stream: a
// PERSISTENT non-stack divergence, never a heal.
function cyclebroken_01c3(m) {
  const { regs, mem } = m;
  m.push16(0x01c6); m.step(0x0874, 17); m.call(0x0874);
  regs.hl = 0x01ba;
  regs.de = 0x60b2;
  regs.bc = 0x0009;
  m.step(0x01cf, 25); // DROPPED: the correct charge here is 30 t
  m.ldir(0x01d1);
  regs.a = 0x01;
  mem.write8(ATTRACT, regs.a);
  mem.write8(LEVEL, regs.a);
  mem.write8(LIVES, regs.a);
  m.step(0x01dc, 46);
  m.push16(0x01df); m.step(0x06b8, 17); m.call(0x06b8);
  m.push16(0x01e2); m.step(0x0207, 17); m.call(0x0207);
  regs.a = 0x01;
  mem.write8(FLIPSCREEN, regs.a, 10);
  mem.write8(GAME_STATE, regs.a);
  mem.write8(BOARD, regs.a);
  regs.xor(regs.a);
  mem.write8(GAME_SUBSTATE, regs.a);
  m.step(0x01f1, 63);
  m.push16(0x01f4); m.step(0x0a53, 17); m.call(0x0a53);
  for (const [de, after, next] of [
    [0x0304, 0x01f7, 0x01fa],
    [0x0202, 0x01fd, 0x0200],
    [0x0200, 0x0203, 0x0206],
  ]) {
    regs.de = de;   m.step(after, 10);
    m.push16(next); m.step(0x309f, 17); m.call(0x309f);
  }
  m.ret();
}

test("CONVERGENT (whole-machine): collapsed handler_01c3 CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_01c3]]), { scenario: SCENARIOS.attract });

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

test("EQUAL (unit): verbatim optimized handler_01c3 matches translated in RAM + registers", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_01c3, optimized_01c3);

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all 19 registers + pc identical");
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_01c3]]), { scenario: SCENARIOS.attract });

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

test("TEETH (unit): a wrong store is CAUGHT and names 0x6229", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_01c3, broken_01c3);

  assert.equal(r.equal, false, "harness FAILED to catch a wrong store — it is worthless");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  assert.equal(
    r.ram.addr,
    0x6229,
    `expected first diff at the broken address 0x6229, got 0x${r.ram.addr.toString(16)}`,
  );
  console.log(
    `  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} ` +
      `(translated ${r.ram.a} vs broken ${r.ram.b})`,
  );
});
