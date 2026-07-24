// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_1186 (fill 0x6507 then gather into 0x6980 — a small helper of
 * the board-2/3 setups). Those setups are cold in the 25m attract, so sub_1186 never
 * dispatches in a plain run; being self-contained (it sets its own HL/DE/IX/BC), it is
 * verified from a crafted entry: a booted machine captured at loc_0fd7's dispatch, cloned,
 * and the routine invoked directly on both sides. PER-INSTRUCTION.
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0fd7 as translated_0fd7 } from "../../translated/state0.js";
import { sub_1186 as translated_1186 } from "../../translated/state0.js";
import { sub_1186 as optimized_1186 } from "../sub_1186.js";
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

// A booted machine captured at loc_0fd7's entry (work RAM initialised); sub_1186 sets its
// own registers, so this is a valid entry for it.
function captureEntry() {
  let entry = null;
  const snap = new Map([[0x0fd7, (mm) => { if (entry === null) entry = mm.clone(); return translated_0fd7(mm); }]]);
  const host = makeMachine(snap);
  host.runFrames(FRAMES);
  if (entry === null) throw new Error("loc_0fd7 never entered — cannot craft a sub_1186 entry");
  return entry;
}
const ENTRY = ROM_PRESENT ? captureEntry() : null;

function broken_1186(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke && addr >= 0x6400 && addr < 0x6a80) { broke = true; return realWrite(addr, value ^ 0xff, busOffset); }
    return realWrite(addr, value, busOffset);
  };
  try { return optimized_1186(m); } finally { m.mem.write8 = realWrite; }
}

function runBoth(optFn = optimized_1186) {
  const a = ENTRY.clone();
  const b = ENTRY.clone();
  const c0 = a.cycles; // both clones start from the identical captured entry
  translated_1186(a);
  optFn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pc: [a.pc, b.pc],
    cycles: [a.cycles - c0, b.cycles - c0],
  };
}

// MANDATORY cycle-total check (recipe step 4): this routine's test is CRAFTED-ENTRY
// only -- no whole-machine/convergent run polices its cycle totals -- so the
// collapse's load-bearing invariant (exact per-block cycle sum) has NO other gate
// here.
test("EQUAL (crafted entry): sub_1186 matches translated in state + registers + cycles", () => {
  const { ram, regs, pc, cycles } = runBoth();
  assert.equal(ram, null, ram ? `RAM diff at 0x${ram.addr.toString(16)}` : "");
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(pc[0], pc[1], "pc must match");
  assert.equal(cycles[1], cycles[0], `cycle total must match the oracle (oracle ${cycles[0]} t, collapsed ${cycles[1]} t)`);
  console.log(`  EQUAL: fill+gather EQUAL (state + regs + pc), ${cycles[0]} t`);
});

test("TEETH (crafted entry): a wrong fill/gather is CAUGHT and NOT-EQUAL", () => {
  const { ram } = runBoth(broken_1186);
  assert.ok(ram != null, "harness FAILED to catch a wrong store");
  console.log(`  TEETH: caught at 0x${ram.addr.toString(16)} (translated ${ram.a} vs broken ${ram.b})`);
});

test("CYCLE-TEETH (crafted entry): a dropped m.step charge yields a wrong total and is CAUGHT", () => {
  const good = runBoth();
  assert.equal(good.cycles[1], good.cycles[0], "the collapsed total should match the oracle");
  // A variant that drops the second fold's charge by 5 t.
  function dropped_1186(m) {
    const { regs } = m;
    regs.hl = 0x11a2;
    regs.de = 0x6507;
    regs.bc = 0x0a0c;
    m.step(0x118f, 30);
    m.push16(0x1192);
    m.step(0x122a, 17);
    m.call(0x122a);
    regs.ix = 0x6500;
    regs.hl = 0x6980;
    regs.b = 0x0a;
    regs.de = 0x0010;
    m.step(0x119e, 36); // DROPPED: the correct charge here is 41 t
    m.push16(0x11a1);
    m.step(0x11d3, 17);
    m.call(0x11d3);
    m.ret();
  }
  const dropped = runBoth(dropped_1186);
  assert.notEqual(dropped.cycles[1], good.cycles[0], "cycle-total assertion has no teeth");
  console.log(`  CYCLE-TEETH: correct ${good.cycles[0]} t vs dropped-charge ${dropped.cycles[1]} t -- caught`);
});
