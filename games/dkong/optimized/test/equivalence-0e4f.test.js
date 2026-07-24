// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_0e4f (draw a SLANTED board element — the record-kind==2 arm of
 * the board-layout renderer; kind 3+ tails to loc_0ee8). 25m's girders slant, so this
 * dispatches during the 25m attract board draw (~frame 518). COLLAPSED (one m.step per
 * basic block); the whole-machine gate uses the CONVERGENT license unconditionally --
 * "atomic" is a property of the scenario exercised, not of the routine (see sub_0350), so
 * the strict gate is never trusted here even though it happened to pass on this scenario.
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0e4f as translated_0e4f } from "../../translated/nmi.js";
import { loc_0e4f as optimized_0e4f } from "../loc_0e4f.js";
import { Machine } from "../../machine.js";
import { unitEquivalence as coreUnitEquivalence } from "../../../../core/equivalence.js";
import { convergentGate, SCENARIOS } from "./convergent.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0e4f;
const FRAMES = 600;
const makeMachine = (overrides) => new Machine(ROM, overrides ? { overrides } : {});

// Break the FIRST video-RAM store this routine makes (the slant's leading cell). The tile
// lands in the tilemap and stays there until the next board build, so a wrong value is a
// PERSISTENT divergence the whole-machine state gate must catch.
function broken_0e4f(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke && addr >= 0x7400 && addr < 0x7800) { broke = true; return realWrite(addr, value ^ 0xff, busOffset); }
    return realWrite(addr, value, busOffset);
  };
  try { return optimized_0e4f(m); } finally { m.mem.write8 = realWrite; }
}

// Cycle-broken twin for the CONVERGENT gate: identical memory + registers to the collapsed
// routine, but the very FIRST block charge (always executed, every invocation) is 5 t short.
// A wrong total shifts the main loop's spin count (0x6019 PRNG entropy), forking the RANDOM
// stream FORKS: a PERSISTENT non-stack divergence, never a heal.
function cyclebroken_0e4f(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x63b3);
  regs.cp(0x02);
  m.step(0x0e54, 15); // DROPPED: the correct charge here is 20 t
  if (regs.fNZ) {
    m.step(0x0ee8, 10);
    return m.call(0x0ee8);
  }
  m.step(0x0e57, 10);
  regs.a = mem.read8(0x63af);
  regs.add(0xf0);
  mem.write8(0x63b5, regs.a);
  regs.hl = mem.read16(0x63ab);
  m.step(0x0e62, 49);

  let at = 0x0e62;
  for (;;) {
    if (at === 0x0e62) {
      regs.a = mem.read8(0x63b5);
      mem.write8(regs.hl, regs.a);
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.a = regs.l;
      regs.and(0x1f);
      m.step(0x0e6a, 37);
      if (regs.fZ) { m.step(0x0e78, 10); at = 0x0e78; continue; }
      regs.a = mem.read8(0x63b5);
      regs.cp(0xf0);
      m.step(0x0e72, 30);
      if (regs.fZ) { m.step(0x0e78, 10); at = 0x0e78; continue; }
      regs.sub(0x10);
      mem.write8(regs.hl, regs.a);
      m.step(0x0e78, 24);
      at = 0x0e78;
      continue;
    }
    if (at === 0x0e78) {
      regs.bc = 0x001f;
      regs.addHl(regs.bc);
      regs.a = mem.read8(0x63b1);
      regs.sub(0x08);
      m.step(0x0e81, 41);
      if (regs.fC) { m.step(0x0ecf, 10); at = 0x0ecf; continue; }
      mem.write8(0x63b1, regs.a);
      regs.a = mem.read8(0x63b2);
      regs.cp(0x00);
      m.step(0x0e8c, 43);
      if (regs.fZ) { m.step(0x0e62, 10); at = 0x0e62; continue; }
      regs.a = mem.read8(0x63b5);
      mem.write8(regs.hl, regs.a);
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.a = regs.l;
      regs.and(0x1f);
      m.step(0x0e97, 47);
      if (regs.fZ) { m.step(0x0ea0, 10); at = 0x0ea0; continue; }
      regs.a = mem.read8(0x63b5);
      regs.sub(0x10);
      mem.write8(regs.hl, regs.a);
      m.step(0x0ea0, 37);
      at = 0x0ea0;
      continue;
    }
    if (at === 0x0ea0) {
      regs.bc = 0x001f;
      regs.addHl(regs.bc);
      regs.a = mem.read8(0x63b1);
      regs.sub(0x08);
      m.step(0x0ea9, 41);
      if (regs.fC) { m.step(0x0ecf, 10); at = 0x0ecf; continue; }
      mem.write8(0x63b1, regs.a);
      regs.a = mem.read8(0x63b2);
      const neg = regs.bit(7, regs.a);
      m.step(0x0eb4, 44);
      if (neg) { m.step(0x0ed3, 10); at = 0x0ed3; continue; }
      regs.a = mem.read8(0x63b5);
      regs.a = regs.inc8(regs.a);
      mem.write8(0x63b5, regs.a);
      regs.cp(0xf8);
      m.step(0x0ec0, 47);
      if (regs.fNZ) { m.step(0x0ec9, 10); at = 0x0ec9; continue; }
      regs.hl = (regs.hl + 1) & 0xffff;
      regs.a = 0xf0;
      mem.write8(0x63b5, regs.a);
      m.step(0x0ec9, 36);
      at = 0x0ec9;
      continue;
    }
    if (at === 0x0ec9) {
      regs.a = regs.l;
      regs.and(0x1f);
      m.step(0x0ecc, 11);
      if (regs.fNZ) { m.step(0x0e62, 10); at = 0x0e62; continue; }
      m.step(0x0ecf, 10);
      at = 0x0ecf;
      continue;
    }
    if (at === 0x0ed3) {
      regs.a = mem.read8(0x63b5);
      regs.a = regs.dec8(regs.a);
      mem.write8(0x63b5, regs.a);
      regs.cp(0xf0);
      m.step(0x0edc, 37);
      if (regs.fP) { m.step(0x0ee5, 10); at = 0x0ee5; continue; }
      regs.hl = (regs.hl - 1) & 0xffff;
      regs.a = 0xf7;
      mem.write8(0x63b5, regs.a);
      m.step(0x0ee5, 36);
      at = 0x0ee5;
      continue;
    }
    if (at === 0x0ee5) {
      m.step(0x0e62, 10);
      at = 0x0e62;
      continue;
    }
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x0da7, 16);
    return;
  }
}

test("CONVERGENT (whole-machine): collapsed loc_0e4f CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_0e4f]]), { scenario: SCENARIOS.attract });
  assert.ok(r.invocations.get(TARGET) >= 1, `override at 0x${TARGET.toString(16)} never dispatched (invocations=${r.invocations.get(TARGET)})`);
  assert.equal(r.pass, true, r.pass ? "" : `NOT convergent: persistent state ${JSON.stringify(r.statePersistent)}, pixelPersistent=${r.pixelPersistent}`);
  console.log(`  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x; ${r.pixDiffFrames} tear frame(s) (max ${r.maxPixels}px, healed), non-stack state persistent = ${r.statePersistent.length}`);
});

test("EQUAL (unit): per-instruction loc_0e4f matches translated in RAM + registers", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_0e4f, optimized_0e4f, { maxFrames: FRAMES + 100 });
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_0e4f]]), { scenario: SCENARIOS.attract });
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.pass, false, "convergent gate FAILED to catch a wrong cycle total -- it is worthless");
  assert.ok(r.statePersistent.length > 0 || r.pixelPersistent, "a caught divergence must be persistent (non-stack state or pixels)");
  console.log(`  TEETH/convergent: caught -- persistent non-stack addrs ${r.statePersistent.length}, pixelPersistent ${r.pixelPersistent}`);
});

test("TEETH (unit): a wrong slant tile is CAUGHT", () => {
  const r = coreUnitEquivalence(makeMachine, TARGET, translated_0e4f, broken_0e4f, { maxFrames: FRAMES + 100 });
  assert.equal(r.equal, false, "harness FAILED to catch a wrong store");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  console.log(`  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} (translated ${r.ram.a} vs broken ${r.ram.b})`);
});
