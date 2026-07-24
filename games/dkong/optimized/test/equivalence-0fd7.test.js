// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_0fd7 (fill the board-1/25m sprite buffer: ldir ROM data into
 * 0x69A8/0x69FC interleaved with the strided-fill helpers sub_122a/sub_11fa/sub_11a6).
 * rst-0x28 table entry 1, dispatched from sub_0f56 during the 25m attract board build
 * (~frame 518).
 *
 * COLLAPSED (one m.step per basic block, see optimized/loc_0fd7.js). The whole-machine gate
 * is the CONVERGENT one, not the strict byte-exact one, UNCONDITIONALLY for a collapsed
 * routine's whole-machine test: "atomic" is a property of the SCENARIO exercised, not of the
 * routine, so a strict pass would be a brittle guarantee that could false-fail later on a
 * benign tear under a scenario this suite doesn't run. Unit + TEETH/unit stay strict (a
 * single captured entry, not a multi-frame run).
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0fd7 as translated_0fd7 } from "../../translated/state0.js";
import { loc_0fd7 as optimized_0fd7 } from "../loc_0fd7.js";
import { Machine } from "../../machine.js";
import { unitEquivalence as coreUnitEquivalence } from "../../../../core/equivalence.js";
import { convergentGate, SCENARIOS } from "./convergent.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0fd7;
const FRAMES = 600;
const makeMachine = (overrides) => new Machine(ROM, overrides ? { overrides } : {});

// Corrupt loc_0fd7's first store to `addr` (a seeded sprite-buffer byte). The buffer is
// blitted to 0x7000 every vblank, so a wrong seed is a divergence the state gate catches.
function brokenAt(addr) {
  return (m) => {
    const realWrite = m.mem.write8.bind(m.mem);
    let broke = false;
    m.mem.write8 = (a, value, busOffset) => {
      if (!broke && a === addr) { broke = true; return realWrite(a, value ^ 0xff, busOffset); }
      return realWrite(a, value, busOffset);
    };
    try { return optimized_0fd7(m); } finally { m.mem.write8 = realWrite; }
  };
}

// Cycle-drop twin for the CONVERGENT TEETH: identical to the collapsed routine except its
// first block's charge is 5 t short (30 -> 25). Same memory/register results, wrong total --
// a wrong cycle sum shifts the main loop's spin count (0x6019 PRNG entropy), forking the
// RANDOM stream: a PERSISTENT divergence, never a heal.
function cyclebroken_0fd7(m) {
  const { regs } = m;
  regs.hl = 0x3ddc;
  regs.de = 0x69a8;
  regs.bc = 0x0010;
  m.step(0x0fe0, 25); // DROPPED: the correct charge here is 30 t
  m.ldirAt(0x0fe0, 0x0fe2);

  regs.hl = 0x3dec;
  regs.de = 0x6407;
  regs.c = 0x1c;
  regs.b = 0x05;
  m.step(0x0fec, 34);
  m.push16(0x0fef);
  m.step(0x122a, 17);
  m.call(0x122a);

  regs.hl = 0x3df4;
  m.step(0x0ff2, 10);
  m.push16(0x0ff5);
  m.step(0x11fa, 17);
  m.call(0x11fa);

  regs.hl = 0x3e00;
  regs.de = 0x69fc;
  regs.bc = 0x0004;
  m.step(0x0ffe, 30);
  m.ldirAt(0x0ffe, 0x1000);

  regs.hl = 0x3e0c;
  m.step(0x1003, 10);
  m.push16(0x1006);
  m.step(0x11a6, 17);
  m.call(0x11a6);

  regs.hl = 0x101b;
  regs.de = 0x6707;
  regs.bc = 0x081c;
  m.step(0x100f, 30);
  m.push16(0x1012);
  m.step(0x122a, 17);
  m.call(0x122a);

  regs.de = 0x6807;
  regs.b = 0x02;
  m.step(0x1017, 17);
  m.push16(0x101a);
  m.step(0x122a, 17);
  m.call(0x122a);

  m.ret();
}

test("CONVERGENT (whole-machine): collapsed loc_0fd7 CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_0fd7]]), { scenario: SCENARIOS.attract });
  assert.ok(r.invocations.get(TARGET) >= 1, `override never dispatched (invocations=${r.invocations.get(TARGET)})`);
  assert.equal(r.pass, true, r.pass ? "" : `NOT convergent: persistent state ${JSON.stringify(r.statePersistent)}, pixelPersistent=${r.pixelPersistent}`);
  console.log(`  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x (25m sprite fill)`);
});

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_0fd7]]), { scenario: SCENARIOS.attract });
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.pass, false, "convergent gate FAILED to catch a wrong cycle total -- it is worthless");
  assert.ok(r.statePersistent.length > 0 || r.pixelPersistent, "a caught divergence must be persistent");
  console.log(`  TEETH/convergent: caught -- persistent non-stack addrs ${r.statePersistent.length}, pixelPersistent ${r.pixelPersistent}`);
});

test("EQUAL (unit): per-instruction loc_0fd7 matches translated in RAM + registers", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_0fd7, optimized_0fd7, { maxFrames: FRAMES + 100 });
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

test("TEETH (unit): a wrong sprite-buffer seed is CAUGHT and names 0x69a8", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_0fd7, brokenAt(0x69a8), { maxFrames: FRAMES + 100 });
  assert.equal(r.equal, false, "harness FAILED to catch a wrong store");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  assert.equal(r.ram.addr, 0x69a8, `expected first diff at 0x69a8, got 0x${r.ram.addr.toString(16)}`);
  console.log(`  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`);
});
