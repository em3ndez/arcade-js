// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_30bd (run the sub_30e4 sprite-buffer pass over four regions:
 * 0x6950/0x6980/0x69B8/0x6A0C). It does not dispatch in the 25m attract; being a
 * self-contained coordinator (it sets its own HL/B) it is verified from a crafted entry: a
 * booted machine captured at loc_0fd7's dispatch, cloned, invoked on both sides.
 * COLLAPSED (one m.step per basic block); since this test has no whole-machine/convergent
 * run to license the total via the PRNG spin, the EQUAL test below also asserts the exact
 * cycle-total delta (123 t: 34+31+31+27) against the oracle.
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0fd7 as translated_0fd7 } from "../../translated/state0.js";
import { sub_30bd as translated_30bd } from "../../translated/state0.js";
import { sub_30bd as optimized_30bd } from "../sub_30bd.js";
import { Machine } from "../../machine.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const FRAMES = 600;
const makeMachine = (overrides) => new Machine(ROM, overrides ? { overrides } : {});

function captureEntry() {
  let entry = null;
  const snap = new Map([[0x0fd7, (mm) => { if (entry === null) entry = mm.clone(); return translated_0fd7(mm); }]]);
  const host = makeMachine(snap);
  host.runFrames(FRAMES);
  if (entry === null) throw new Error("loc_0fd7 never entered — cannot craft a sub_30bd entry");
  return entry;
}
const ENTRY = ROM_PRESENT ? captureEntry() : null;

// Seed a few nonzero sprite records so the sub_30e4 pass has something to transform.
function seed(mm) {
  for (const base of [0x6950, 0x6980, 0x69b8, 0x6a0c]) {
    for (let i = 0; i < 8; i++) mm.mem.write8(base + i, (base + i) & 0xff);
  }
  return mm;
}

function broken_30bd(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke && addr >= 0x6900 && addr < 0x6b00) { broke = true; return realWrite(addr, value ^ 0xff, busOffset); }
    return realWrite(addr, value, busOffset);
  };
  try { return optimized_30bd(m); } finally { m.mem.write8 = realWrite; }
}

function runBoth(optFn = optimized_30bd) {
  const a = seed(ENTRY.clone());
  const b = seed(ENTRY.clone());
  const c0a = a.cycles;
  const c0b = b.cycles;
  translated_30bd(a);
  optFn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pc: [a.pc, b.pc],
    cycles: [a.cycles - c0a, b.cycles - c0b],
  };
}

test("EQUAL (crafted entry): sub_30bd matches translated in state + registers", () => {
  const { ram, regs, pc, cycles } = runBoth();
  assert.equal(ram, null, ram ? `RAM diff at 0x${ram.addr.toString(16)}` : "");
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(pc[0], pc[1], "pc must match");
  // MANDATORY cycle-total check (no whole-machine/convergent run covers this crafted-entry
  // test's PRNG-spin gate): the collapsed prep code's total (123 t across the four blocks)
  // plus the shared sub_30e4 calls (identical routine both sides) must match the oracle
  // exactly, or the main-loop spin count would fork.
  assert.equal(cycles[1], cycles[0], `cycle total must match oracle (oracle ${cycles[0]} t, optimized ${cycles[1]} t)`);
  console.log(`  EQUAL: four-region pass EQUAL (state + regs + pc + cycles=${cycles[1]}t)`);
});

test("TEETH (crafted entry): a wrong sprite-buffer write is CAUGHT and NOT-EQUAL", () => {
  const { ram } = runBoth(broken_30bd);
  assert.ok(ram != null, "harness FAILED to catch a wrong store");
  console.log(`  TEETH: caught at 0x${ram.addr.toString(16)} (translated ${ram.a} vs broken ${ram.b})`);
});
