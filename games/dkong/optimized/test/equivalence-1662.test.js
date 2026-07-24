// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for tail_1662 (bump the animation counter 0x6388, rst 0x30 caller-skip
 * guard, then rst 0x38 stepping the 0x690B sprite block). It does not dispatch in the 25m
 * attract; being self-contained it is verified from a crafted entry: a booted machine
 * captured at loc_0fd7's dispatch, cloned, invoked on both sides. COLLAPSED to one m.step
 * per basic block (see optimized/tail_1662.js). Since this test is crafted-entry only (no
 * whole-machine/convergent run reaches it), the PRNG gate does not cover a wrong cycle total
 * here, so a MANDATORY cycle-total assertion is added below (oracle vs collapsed machine
 * cycle delta from the one captured entry).
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0fd7 as translated_0fd7 } from "../../translated/state0.js";
import { tail_1662 as translated_1662 } from "../../translated/state0.js";
import { tail_1662 as optimized_1662 } from "../tail_1662.js";
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
  if (entry === null) throw new Error("loc_0fd7 never entered — cannot craft a tail_1662 entry");
  return entry;
}
const ENTRY = ROM_PRESENT ? captureEntry() : null;

function brokenAt(addr) {
  return (m) => {
    const realWrite = m.mem.write8.bind(m.mem);
    let broke = false;
    m.mem.write8 = (a, value, busOffset) => {
      if (!broke && a === addr) { broke = true; return realWrite(a, value ^ 0xff, busOffset); }
      return realWrite(a, value, busOffset);
    };
    try { return optimized_1662(m); } finally { m.mem.write8 = realWrite; }
  };
}

function runBoth(optFn = optimized_1662) {
  const a = ENTRY.clone();
  const b = ENTRY.clone();
  const ca0 = a.cycles, cb0 = b.cycles;
  translated_1662(a);
  optFn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pc: [a.pc, b.pc],
    cycles: [a.cycles - ca0, b.cycles - cb0],
  };
}

test("EQUAL (crafted entry): tail_1662 matches translated in state + registers + cycle total", () => {
  const { ram, regs, pc, cycles } = runBoth();
  assert.equal(ram, null, ram ? `RAM diff at 0x${ram.addr.toString(16)}` : "");
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(pc[0], pc[1], "pc must match");
  // MANDATORY cycle-total check (this test is crafted-entry only -- no whole-machine/
  // convergent run covers a wrong cycle total here): the collapsed routine must charge
  // the exact same T-state total as the oracle from this one captured entry.
  assert.equal(cycles[1], cycles[0], `cycle total mismatch: oracle ${cycles[0]} vs optimized ${cycles[1]}`);
  console.log(`  EQUAL: counter bump + sprite step EQUAL (state + regs + pc), cycles ${cycles[1]} t == oracle ${cycles[0]} t`);
});

test("TEETH (crafted entry): a wrong counter is CAUGHT and names 0x6388", () => {
  const { ram } = runBoth(brokenAt(0x6388));
  assert.ok(ram != null, "harness FAILED to catch a wrong store");
  assert.equal(ram.addr, 0x6388, `expected first diff at 0x6388, got 0x${ram.addr.toString(16)}`);
  console.log(`  TEETH: caught at 0x${ram.addr.toString(16)} (translated ${ram.a} vs broken ${ram.b})`);
});
