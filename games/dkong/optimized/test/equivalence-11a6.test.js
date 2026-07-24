// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_11a6 (coordinator: sub_11ec + sub_122a fills, mark slots
 * 0x6680/0x6690 live, then sub_11d3 gather into 0x6A18). Reached from loc_0fd7 during the
 * 25m attract board build (~frame 518). COLLAPSED (one m.step per basic block, 14→3).
 *
 * The whole-machine gate is the CONVERGENT one, unconditionally — "atomic" is a property of
 * the scenario tested, not of the routine, so a strict pass here would be a brittle guarantee
 * that could later false-fail on a benign tear. (This collapse does in fact read byte-exact
 * on this scenario; it is gated the robust way regardless.)
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_11a6 as translated_11a6 } from "../../translated/state0.js";
import { sub_11a6 as optimized_11a6 } from "../sub_11a6.js";
import { Machine } from "../../machine.js";
import { unitEquivalence as coreUnitEquivalence } from "../../../../core/equivalence.js";
import { convergentGate, SCENARIOS } from "./convergent.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x11a6;
const FRAMES = 600;
const makeMachine = (overrides) => new Machine(ROM, overrides ? { overrides } : {});

// Corrupt sub_11a6's own IX+0 store (the 0x6680 slot mark = 0x01) -- distinct from its
// callees' writes, which land at 0x6683+/0x6687+ first. A wrong live-mark is a divergence
// the state gate catches.
function brokenAt(addr) {
  return (m) => {
    const realWrite = m.mem.write8.bind(m.mem);
    let broke = false;
    m.mem.write8 = (a, value, busOffset) => {
      if (!broke && a === addr) { broke = true; return realWrite(a, value ^ 0xff, busOffset); }
      return realWrite(a, value, busOffset);
    };
    try { return optimized_11a6(m); } finally { m.mem.write8 = realWrite; }
  };
}

test("CONVERGENT (whole-machine): collapsed sub_11a6 CONVERGES vs translated", () => {
  const r = convergentGate(new Map([[TARGET, optimized_11a6]]), { scenario: SCENARIOS.attract });
  assert.ok(r.invocations.get(TARGET) >= 1, `override never dispatched (invocations=${r.invocations.get(TARGET)})`);
  assert.equal(r.pass, true, r.pass ? "" : `NOT convergent: persistent state ${JSON.stringify(r.statePersistent)}, pixelPersistent=${r.pixelPersistent}`);
  console.log(`  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x; ${r.pixDiffFrames} tear frame(s) (max ${r.maxPixels}px, healed), non-stack state persistent = ${r.statePersistent.length}`);
});

test("EQUAL (unit): per-instruction sub_11a6 matches translated in RAM + registers", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_11a6, optimized_11a6, { maxFrames: FRAMES + 100 });
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

// Cycle-broken twin for the CONVERGENT gate: identical memory + registers, but block 1's
// charge is 5 t short (37 -> 32). A wrong total shifts the main loop's spin count (0x6019,
// the PRNG entropy) -- a PERSISTENT divergence, never a heal. This is the teeth for the
// collapse's load-bearing invariant, and precisely the failure a fold that omits the call's
// own 17 t charge would produce.
function cyclebroken_11a6(m) {
  const { regs, mem } = m;
  regs.de = 0x6683;
  regs.bc = 0x020e;
  m.push16(0x11af);
  m.step(0x11ec, 32); // DROPPED: the correct charge here is 37 t
  m.call(0x11ec);
  regs.hl = 0x3e08;
  regs.de = 0x6687;
  regs.bc = 0x020c;
  m.push16(0x11bb);
  m.step(0x122a, 47);
  m.call(0x122a);
  regs.ix = 0x6680;
  mem.write8((regs.ix + 0x00) & 0xffff, 0x01);
  mem.write8((regs.ix + 0x10) & 0xffff, 0x01);
  regs.hl = 0x6a18;
  regs.b = 0x02;
  regs.de = 0x0010;
  m.push16(0x11d2);
  m.step(0x11d3, 96);
  m.call(0x11d3);
  m.ret();
}

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_11a6]]), { scenario: SCENARIOS.attract });
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.pass, false, "convergent gate FAILED to catch a wrong cycle total");
  assert.ok(r.statePersistent.length > 0 || r.pixelPersistent, "a caught divergence must be persistent");
  console.log(`  TEETH/convergent: caught -- persistent non-stack addrs ${r.statePersistent.length}, pixelPersistent ${r.pixelPersistent}`);
});

test("TEETH (unit): a wrong slot mark is CAUGHT and names 0x6680", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_11a6, brokenAt(0x6680), { maxFrames: FRAMES + 100 });
  assert.equal(r.equal, false, "harness FAILED to catch a wrong store");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  assert.equal(r.ram.addr, 0x6680, `expected first diff at 0x6680, got 0x${r.ram.addr.toString(16)}`);
  console.log(`  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`);
});
