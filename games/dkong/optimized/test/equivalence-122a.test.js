// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_122a (strided block copy: B passes of 4 bytes, stride C+4 —
 * a sprite/shadow-table filler used across the per-board setups). Called from loc_0fd7
 * during the 25m attract board build (~frame 518), first with DE=0x6407.
 *
 * COLLAPSED (one m.step per basic block, see optimized/sub_122a.js). The whole-machine gate
 * is the CONVERGENT one, not the strict byte-exact one, UNCONDITIONALLY for a collapsed
 * routine's whole-machine test: "atomic" is a property of the SCENARIO exercised, not of the
 * routine, so a strict pass here would be a brittle guarantee that could false-fail later on
 * a benign tear under a scenario this suite doesn't run. Unit + TEETH/unit stay strict (a
 * single captured entry, not a multi-frame run, so there is nothing for an NMI to land
 * inside between the capture and the routine returning).
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_122a as translated_122a } from "../../translated/state0.js";
import { sub_122a as optimized_122a } from "../sub_122a.js";
import { Machine } from "../../machine.js";
import { unitEquivalence as coreUnitEquivalence } from "../../../../core/equivalence.js";
import { convergentGate, SCENARIOS } from "./convergent.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x122a;
const FRAMES = 600;
const makeMachine = (overrides) => new Machine(ROM, overrides ? { overrides } : {});

// Corrupt the first destination byte sub_122a writes (its first `ld (de),a`, addr in the
// shadow-table range -- NOT the stack pushes). The tables feed rendering, so a wrong copy
// is a divergence the state gate catches.
function brokenFirstDest(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke && addr >= 0x6400 && addr < 0x6a80) { broke = true; return realWrite(addr, value ^ 0xff, busOffset); }
    return realWrite(addr, value, busOffset);
  };
  try { return optimized_122a(m); } finally { m.mem.write8 = realWrite; }
}

// Cycle-drop twin for the CONVERGENT TEETH: identical to the collapsed routine except
// Block A's charge is 5 t short (29 -> 24). Same memory/register results, wrong total --
// a wrong cycle sum shifts the main loop's spin count (0x6019 PRNG entropy), forking the
// RANDOM stream: a PERSISTENT divergence, never a heal.
function cyclebroken_122a(m) {
  const { regs, mem } = m;
  do {
    m.push16(regs.hl);
    m.push16(regs.bc);
    regs.b = 0x04;
    m.step(0x122e, 24); // DROPPED: the correct charge here is 29 t
    do {
      regs.a = mem.read8(regs.hl);
      mem.write8(regs.de, regs.a);
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.e = regs.inc8(regs.e);
      regs.djnz();
      m.step(regs.b !== 0 ? 0x122e : 0x1234, regs.b !== 0 ? 37 : 32);
    } while (regs.b !== 0);
    regs.bc = m.pop16();
    regs.hl = m.pop16();
    regs.a = regs.e;
    regs.add(regs.c);
    regs.e = regs.a;
    regs.djnz();
    m.step(regs.b !== 0 ? 0x122a : 0x123b, regs.b !== 0 ? 45 : 40);
  } while (regs.b !== 0);
  m.ret();
}

test("CONVERGENT (whole-machine): collapsed sub_122a CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_122a]]), { scenario: SCENARIOS.attract });
  assert.ok(r.invocations.get(TARGET) >= 1, `override never dispatched (invocations=${r.invocations.get(TARGET)})`);
  assert.equal(r.pass, true, r.pass ? "" : `NOT convergent: persistent state ${JSON.stringify(r.statePersistent)}, pixelPersistent=${r.pixelPersistent}`);
  console.log(`  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x (board setups)`);
});

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_122a]]), { scenario: SCENARIOS.attract });
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.pass, false, "convergent gate FAILED to catch a wrong cycle total -- it is worthless");
  assert.ok(r.statePersistent.length > 0 || r.pixelPersistent, "a caught divergence must be persistent");
  console.log(`  TEETH/convergent: caught -- persistent non-stack addrs ${r.statePersistent.length}, pixelPersistent ${r.pixelPersistent}`);
});

test("EQUAL (unit): per-instruction sub_122a matches translated in RAM + registers", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_122a, optimized_122a, { maxFrames: FRAMES + 100 });
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

test("TEETH (unit): a wrong strided copy is CAUGHT", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_122a, brokenFirstDest, { maxFrames: FRAMES + 100 });
  assert.equal(r.equal, false, "harness FAILED to catch a wrong store");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  console.log(`  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`);
});
