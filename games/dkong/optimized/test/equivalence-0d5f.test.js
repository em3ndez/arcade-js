// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_0d5f (finish board setup: run two helpers, arm the substate
 * — SUBSTATE_TIMER=0x40, GAME_SUBSTATE++ — copy the sprite template, then seed the board
 * sprites, branching on BOARD). Reached from loc_3fa0 in the 25m attract board build
 * (~frame 518). COLLAPSED (one m.step per basic block); atomicity across callers is not
 * provable, so the whole-machine gate is CONVERGENT (see optimized/loc_0d5f.js). The
 * BOARD==4 (100m rivets) arm is cold in the convergent run too (attract never sets
 * BOARD=4), so it is covered by a synthesized BOARD=4 clone WITH a cycle-total check
 * (the mandatory check for a path no whole-machine/convergent run exercises).
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0d5f as translated_0d5f } from "../../translated/nmi.js";
import { loc_0d5f as optimized_0d5f } from "../loc_0d5f.js";
import { Machine } from "../../machine.js";
import {
  unitEquivalence as coreUnitEquivalence,
  firstStateDiff,
  firstRegDiff,
} from "../../../../core/equivalence.js";
import { convergentGate, SCENARIOS } from "./convergent.js";
import { SUBSTATE_TIMER, SPRITE_BUFFER, SPRITE_OBJ_BLOCK, BOARD } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0d5f;
const FRAMES = 600;
const makeMachine = (overrides) => new Machine(ROM, overrides ? { overrides } : {});

// Break the SUBSTATE_TIMER (0x6009) store: it arms the board-setup substate, so a wrong
// value diverges substate timing (and the byte itself in the dump).
function broken_0d5f(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke && addr === 0x6009) { broke = true; return realWrite(addr, value ^ 0xff, busOffset); }
    return realWrite(addr, value, busOffset);
  };
  try { return optimized_0d5f(m); } finally { m.mem.write8 = realWrite; }
}

function captureEntry() {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => { if (entry === null) entry = mm.clone(); return translated_0d5f(mm); }]]);
  const host = makeMachine(snap);
  host.runFrames(FRAMES);
  if (entry === null) throw new Error("loc_0d5f never entered within the run window");
  return entry;
}
const ENTRY = ROM_PRESENT ? captureEntry() : null;

test("CONVERGENT (whole-machine): collapsed loc_0d5f CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  // loc_0d5f is COLLAPSED and its atomicity across callers (loc_3fa0's board-build
  // chain) is not provable, so the strict byte-exact gate is the wrong tool -- see
  // optimized/loc_0d5f.js.
  const r = convergentGate(new Map([[TARGET, optimized_0d5f]]), { scenario: SCENARIOS.attract });
  assert.ok(r.invocations.get(TARGET) >= 1, `override never dispatched (invocations=${r.invocations.get(TARGET)})`);
  assert.equal(
    r.pass,
    true,
    r.pass ? "" : `NOT convergent: persistent state ${JSON.stringify(r.statePersistent)}, pixelPersistent=${r.pixelPersistent}`,
  );
  console.log(
    `  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x (25m else-arm); ${r.pixDiffFrames} tear frame(s) ` +
      `(max ${r.maxPixels}px, healed), non-stack state persistent = ${r.statePersistent.length}`,
  );
});

test("EQUAL (unit): collapsed loc_0d5f matches translated in RAM + registers", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_0d5f, optimized_0d5f, { maxFrames: FRAMES + 100 });
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

test("BRANCH (BOARD==4): the 100m rivets arm is EQUAL (synthesized clone) + cycle total", () => {
  const a = ENTRY.clone(); a.mem.write8(0x6227, 4); // BOARD = 4 on both sides
  const b = ENTRY.clone(); b.mem.write8(0x6227, 4);
  const c0a = a.cycles;
  const c0b = b.cycles;
  translated_0d5f(a);
  optimized_0d5f(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  const regs = firstRegDiff(a.regs, b.regs);
  assert.equal(ram, null, ram ? `RAM diff at 0x${ram.addr.toString(16)}` : "");
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(a.pc, b.pc, "pc must match");
  // MANDATORY cycle-total check: this arm is cold in the convergent whole-machine run
  // (attract never sets BOARD=4), so no whole-machine/convergent run polices its cycle
  // total -- assert it explicitly here (the collapsed blocks: 40 + 47 + 37 = 124 t).
  const oracleCycles = a.cycles - c0a;
  const optCycles = b.cycles - c0b;
  assert.equal(optCycles, oracleCycles, `cycle total ${optCycles} != oracle ${oracleCycles}`);
  console.log(`  BRANCH BOARD==4: rivets arm EQUAL (RAM + regs + pc); ${oracleCycles}t both sides`);
});

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  // Cycle-drop twin, not value-corruption (a value twin can hang a long convergent run
  // instead of diverging cleanly; the unit TEETH below covers value corruption).
  function cyclebroken_0d5f(m) {
    const { regs, mem } = m;
    m.push16(0x0d62); m.step(0x0f56, 17); m.call(0x0f56);
    m.push16(0x0d65); m.step(0x2441, 17); m.call(0x2441);
    regs.hl = SUBSTATE_TIMER;
    mem.write8(regs.hl, 0x40);
    regs.hl = (regs.hl + 1) & 0xffff;
    mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
    m.step(0x0d6c, 32); // DROPPED: correct total is 37 t, short by 5
    regs.hl = 0x385c;
    m.push16(0x0d72);
    m.step(0x004e, 27);
    m.call(0x004e);
    regs.de = SPRITE_BUFFER;
    regs.bc = 0x0008;
    m.step(0x0d78, 20);
    m.ldirAt(0x0d78, 0x0d7a);
    regs.a = mem.read8(BOARD);
    regs.cp(0x04);
    m.step(0x0d7f, 20);
    if (regs.fZ) {
      regs.hl = SPRITE_OBJ_BLOCK; regs.c = 0x44;
      m.push16(0x0d91); m.step(0x0038, 40); m.call(0x0038);
      regs.de = 0x0004; regs.bc = 0x0210; regs.hl = SPRITE_BUFFER;
      m.push16(0x0d9d); m.step(0x003d, 47); m.call(0x003d);
      regs.bc = 0x02f8; regs.hl = 0x6903;
      m.push16(0x0da6); m.step(0x003d, 37); m.call(0x003d);
      m.ret();
      return;
    }
    regs.rrca(); regs.rrca();
    m.step(0x0d83, 15);
    if (regs.fC) { m.ret(11); return; }
    regs.hl = 0x690b; regs.c = 0xfc;
    m.push16(0x0d8a); m.step(0x0038, 33); m.call(0x0038);
    m.ret();
  }
  const r = convergentGate(new Map([[TARGET, cyclebroken_0d5f]]), { scenario: SCENARIOS.attract });
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

test("TEETH (unit): a wrong SUBSTATE_TIMER store is CAUGHT and names 0x6009", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_0d5f, broken_0d5f, { maxFrames: FRAMES + 100 });
  assert.equal(r.equal, false, "harness FAILED to catch a wrong store");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  assert.equal(r.ram.addr, 0x6009, `expected first diff at 0x6009, got 0x${r.ram.addr.toString(16)}`);
  console.log(`  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`);
});
