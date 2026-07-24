// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_11fa (straight-line record scatter into an IX object slot at
 * 0x66A0, mirrored to 0x6A28). Reached from loc_0fd7 during the 25m attract board build
 * (~frame 518, HL=0x3DF4). COLLAPSED to a single m.step (straight-line, no branch, no
 * loop, no callee, no hardware-bus write); gated CONVERGENT per the collapse-sweep's
 * blanket rule (any routine with a whole-machine test is gated convergent, not strict,
 * regardless of whether the collapse happens to pass strict in a given scenario).
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_11fa as translated_11fa } from "../../translated/state0.js";
import { sub_11fa as optimized_11fa } from "../sub_11fa.js";
import { unitEquivalence as coreUnitEquivalence } from "../../../../core/equivalence.js";
import { Machine } from "../../machine.js";
import { convergentGate, SCENARIOS } from "./convergent.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x11fa;
const FRAMES = 600;
const makeMachine = (overrides) => new Machine(ROM, overrides ? { overrides } : {});

// Corrupt sub_11fa's first store (IX+0 = 0x01 at 0x66A0, marking the object slot live).
// The slot feeds the object system, so a wrong mark is a divergence the state gate catches.
// Used for the UNIT teeth only (a single-entry diff, not a long convergent run).
function brokenFirstDest(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke && addr >= 0x6400 && addr < 0x6a80) { broke = true; return realWrite(addr, value ^ 0xff, busOffset); }
    return realWrite(addr, value, busOffset);
  };
  try { return optimized_11fa(m); } finally { m.mem.write8 = realWrite; }
}

/**
 * Cycle-broken twin for the CONVERGENT gate: identical memory ops to the collapsed
 * routine, but the single folded charge is 5 t short (264 instead of 269). A wrong
 * total shifts the main loop's spin count (0x6019, the PRNG entropy), forking the
 * RANDOM stream permanently -- a PERSISTENT non-stack divergence, never a heal.
 */
function cyclebroken_11fa(m) {
  const { regs, mem } = m;
  regs.ix = 0x66a0;
  mem.write8((regs.ix + 0x00) & 0xffff, 0x01);
  regs.de = 0x6a28;
  regs.a = mem.read8(regs.hl);
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a);
  mem.write8(regs.de, regs.a);
  regs.e = regs.inc8(regs.e);
  regs.hl = (regs.hl + 1) & 0xffff;
  regs.a = mem.read8(regs.hl);
  mem.write8((regs.ix + 0x07) & 0xffff, regs.a);
  mem.write8(regs.de, regs.a);
  regs.e = regs.inc8(regs.e);
  regs.hl = (regs.hl + 1) & 0xffff;
  regs.a = mem.read8(regs.hl);
  mem.write8((regs.ix + 0x08) & 0xffff, regs.a);
  mem.write8(regs.de, regs.a);
  regs.e = regs.inc8(regs.e);
  regs.hl = (regs.hl + 1) & 0xffff;
  regs.a = mem.read8(regs.hl);
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a);
  mem.write8(regs.de, regs.a);
  regs.hl = (regs.hl + 1) & 0xffff;
  regs.a = mem.read8(regs.hl);
  mem.write8((regs.ix + 0x09) & 0xffff, regs.a);
  regs.hl = (regs.hl + 1) & 0xffff;
  regs.a = mem.read8(regs.hl);
  mem.write8((regs.ix + 0x0a) & 0xffff, regs.a);
  m.step(0x1229, 264); // DROPPED: the correct total is 269 t
  m.ret();
}

test("CONVERGENT (whole-machine): collapsed sub_11fa CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_11fa]]), { scenario: SCENARIOS.attract });
  assert.ok(r.invocations.get(TARGET) >= 1, `override never dispatched (invocations=${r.invocations.get(TARGET)})`);
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

test("EQUAL (unit): collapsed sub_11fa matches translated in RAM + registers", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_11fa, optimized_11fa, { maxFrames: FRAMES + 100 });
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_11fa]]), { scenario: SCENARIOS.attract });
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

test("TEETH (unit): a wrong scatter is CAUGHT", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_11fa, brokenFirstDest, { maxFrames: FRAMES + 100 });
  assert.equal(r.equal, false, "harness FAILED to catch a wrong store");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  console.log(`  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`);
});
