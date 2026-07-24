// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_1131 (board-4 (100m/rivets) sprite-and-object setup — rst-0x28 table entry, the
 * board setup sub_0f56 dispatches to). Cold in the 25m attract; being a self-contained
 * coordinator (it sets its own registers) it is verified from a crafted entry: a booted
 * machine captured at loc_0fd7's dispatch, cloned, and the routine invoked on both sides.
 * PER-INSTRUCTION.
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0fd7 as translated_0fd7 } from "../../translated/state0.js";
import { loc_1131 as translated_1131 } from "../../translated/state0.js";
import { loc_1131 as optimized_1131 } from "../loc_1131.js";
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
  if (entry === null) throw new Error("loc_0fd7 never entered — cannot craft a loc_1131 entry");
  return entry;
}
const ENTRY = ROM_PRESENT ? captureEntry() : null;

function broken_1131(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke && addr >= 0x6400 && addr < 0x6a80) { broke = true; return realWrite(addr, value ^ 0xff, busOffset); }
    return realWrite(addr, value, busOffset);
  };
  try { return optimized_1131(m); } finally { m.mem.write8 = realWrite; }
}

function runBoth(optFn = optimized_1131) {
  const a = ENTRY.clone();
  const b = ENTRY.clone();
  translated_1131(a);
  optFn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pc: [a.pc, b.pc],
  };
}

test("EQUAL (crafted entry): loc_1131 matches translated in state + registers", () => {
  const { ram, regs, pc } = runBoth();
  assert.equal(ram, null, ram ? `RAM diff at 0x${ram.addr.toString(16)}` : "");
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(pc[0], pc[1], "pc must match");
  console.log("  EQUAL: board-4 (100m/rivets) setup EQUAL (state + regs + pc)");
});

test("TEETH (crafted entry): a wrong setup store is CAUGHT and NOT-EQUAL", () => {
  const { ram } = runBoth(broken_1131);
  assert.ok(ram != null, "harness FAILED to catch a wrong store");
  console.log(`  TEETH: caught at 0x${ram.addr.toString(16)} (translated ${ram.a} vs broken ${ram.b})`);
});

// -- CYCLE TOTAL (mandatory: this test is crafted-entry only, no whole-machine or
// convergent run exists to catch a wrong cycle sum, so it is pinned directly here) --

test("CYCLE TOTAL (crafted entry): collapsed loc_1131 charges the SAME total as the oracle", () => {
  const a = ENTRY.clone(); // translated oracle
  const b = ENTRY.clone(); // optimized (collapsed)
  const a0 = a.cycles;
  const b0 = b.cycles;
  translated_1131(a);
  optimized_1131(b);
  const aCyc = a.cycles - a0;
  const bCyc = b.cycles - b0;
  assert.equal(bCyc, aCyc, `cycle total drifted: oracle ${aCyc} t vs collapsed ${bCyc} t`);
  console.log(`  CYCLE TOTAL: collapsed ${bCyc} t == oracle ${aCyc} t`);
});

test("CYCLE TEETH (crafted entry): a dropped m.step charge yields a wrong total and is CAUGHT", () => {
  const a = ENTRY.clone();
  const a0 = a.cycles;
  translated_1131(a);
  const oracleCyc = a.cycles - a0;

  // A twin identical to optimized_1131 except the FIRST call-charge step (Block 1,
  // ending at sub_122a) is 5 t short.
  function shortCharge_1131(m) {
    const { regs, mem } = m;
    regs.hl = 0x3df0;
    regs.de = 0x6407;
    regs.bc = 0x051c;
    m.push16(0x113d);
    m.step(0x122a, 47 - 5); // DROPPED: the correct charge here is 47 t
    m.call(0x122a);

    regs.hl = 0x3e14;
    m.push16(0x1143);
    m.step(0x11a6, 27);
    m.call(0x11a6);

    regs.hl = 0x3e54;
    regs.de = 0x6a0c;
    regs.bc = 0x000c;
    m.step(0x114c, 30);
    m.ldir(0x114e);

    regs.hl = 0x1182;
    regs.de = 0x64a3;
    regs.bc = 0x021e;
    m.push16(0x115a);
    m.step(0x11ec, 47);
    m.call(0x11ec);

    regs.hl = 0x117e;
    regs.de = 0x64a7;
    regs.bc = 0x021c;
    m.push16(0x1166);
    m.step(0x122a, 47);
    m.call(0x122a);

    regs.ix = 0x64a0;
    mem.write8((regs.ix + 0x00) & 0xffff, 0x01);
    mem.write8((regs.ix + 0x20) & 0xffff, 0x01);
    regs.hl = 0x6950;
    regs.b = 0x02;
    regs.de = 0x0020;
    m.push16(0x117d);
    m.step(0x11d3, 96);
    m.call(0x11d3);

    m.ret();
  }

  const w = ENTRY.clone();
  const w0 = w.cycles;
  shortCharge_1131(w);
  const wrongCyc = w.cycles - w0;

  assert.notEqual(wrongCyc, oracleCyc, "cycle-total assertion has no teeth");
  console.log(`  CYCLE TEETH: dropped-charge ${wrongCyc} t != oracle ${oracleCyc} t (caught)`);
});
