// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_3096 -- XOR mask C into 2 bytes at HL, stride DE (a fixed
 * 2-iteration RMW loop). See optimized/sub_3096.js for the full behaviour.
 *
 * GATE: STRICT WHOLE-MACHINE (byte-exact), driven -- plus a unit crafted-entry pair.
 * MEASURED reachability (the oracle docstring's "unreachable frontier" is STALE -- its
 * caller sub_306f and sub_306f's callers loc_0ae8/sub_1732/sub_1757 are all wired now):
 *   - 62 dispatches over a coin+start gameplay run (all in the loc_0ae8 intro cutscene,
 *     which drives sub_306f's every-8th-frame animation tick; 31 ticks x 2 calls = 62).
 *   - io.nmiMask == 0 at 100% of those 62 dispatches -> ATOMIC (loc_0ae8 runs inside
 *     the NMI game-state cascade, mask cleared on entry), so the vblank NMI cannot land
 *     inside the routine and the per-block cycle fold cannot push a coarse PC.
 * An atomic byte-exact collapse passes the ordinary STRICT gate (docs/06 -- the
 * CONVERGENT gate is only for INTERRUPTIBLE collapses), and being non-vacuous (62
 * invocations) the strict per-frame RAM diff also covers the cycle total through the
 * spin-count / stack channel. The two caller configs (HL=0x6909, HL=0x691D) are the
 * routine's ONLY two live entries; both run its SINGLE path (B=2 is a compile-time
 * constant -> no data-dependent branch), and both are covered.
 *
 * Jobs:
 *   1. EQUAL (whole-machine, strict) -- optimized == oracle across the full per-frame RAM
 *      trace of a coin+start run; the override must fire 62x (non-vacuous).
 *   2. EQUAL (unit, both HL configs) -- crafted entries prove RAM + full register file
 *      (incl. F) + pc identical for HL=0x6909 and HL=0x691D.
 *   3. CYCLES (unit) -- the exact oracle total (96 t) is charged (explicit pin: the
 *      collapse's total, belt-and-suspenders over the strict gate's PRNG coverage).
 *   4. TEETH (value) -- a wrong sprite-attribute store is CAUGHT (whole-machine: a
 *      persistent 0x6909 corruption; unit: named first-diff at 0x6909).
 *   5. TEETH (cycles) -- a dropped m.step charge yields a wrong total, CAUGHT both by the
 *      deterministic unit pin and by the strict whole-machine PRNG fork.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0fd7 as translated_0fd7 } from "../../translated/state0.js";
import { sub_3096 as translated_3096 } from "../../translated/state0.js";
import { sub_3096 as optimized_3096 } from "../sub_3096.js";
import { Machine } from "../../machine.js";
import {
  wholeMachineEquivalence,
  firstStateDiff,
  firstRegDiff,
} from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x3096;
const ORACLE_CYCLES = 96; // 7 (ld b) + (29+13) pass1 + (29+8) pass2 + 10 (ret) -- measured
const CELL_0 = 0x6909; // record-0 attribute byte (SPRITE_OBJ_BLOCK+1), config-1's first store
const CELL_1 = 0x691d; // record-5 attribute byte (SPRITE_OBJ_BLOCK+0x15), config-2's first store

// A coin+start tape that credits a game and plays the loc_0ae8 intro cutscene, where all
// 62 sub_3096 dispatches occur (by ~frame 900). 1000 frames leaves a tail for a wrong
// cycle total to fork the spin count (0x6019 PRNG) and surface downstream.
const TAPE = [
  { port: 0x7d00, bits: 0x80, frame: 400, dur: 1 }, // coin
  { port: 0x7d00, bits: 0x04, frame: 460, dur: 1 }, // start (1P)
];
const FRAMES = 1000;
const drivenFactory = (overrides) => {
  const m = new Machine(ROM, overrides ? { overrides } : {});
  m.inputTape = TAPE.map((t) => ({ ...t }));
  return m;
};

// -- deterministic attract entry for the UNIT crafted tests (sub_306f's pattern) ------
const CAPTURE_FRAMES = 600;
function captureEntry() {
  let entry = null;
  const snap = new Map([[0x0fd7, (mm) => { if (entry === null) entry = mm.clone(); return translated_0fd7(mm); }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(CAPTURE_FRAMES);
  if (entry === null) throw new Error("loc_0fd7 never entered -- cannot craft a sub_3096 entry");
  return entry;
}
const ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Craft the two live-ins + seed the two target bytes (both clones identical), so the
 *  RMW is exercised on non-zero data (XOR-with-existing differs from a plain store). */
function craft(hl, seed0, seed1) {
  const c = ENTRY.clone();
  c.regs.hl = hl;
  c.regs.c = 0x81; // the mask (from sub_306f)
  c.regs.de = 0x0004; // the stride (loc_0038 side effect)
  c.mem.write8(hl, seed0);
  c.mem.write8((hl + 0x04) & 0xffff, seed1);
  return c;
}

// -- 1. EQUAL (whole-machine, strict) -----------------------------------------

test("EQUAL (whole-machine strict): optimized sub_3096 matches oracle over a driven run", () => {
  const r = wholeMachineEquivalence(drivenFactory, FRAMES, new Map([[TARGET, optimized_3096]]));
  const fired = r.invocations.get(TARGET);
  assert.ok(fired >= 1, `override at 0x${TARGET.toString(16)} never dispatched (invocations=${fired})`);
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `NOT equal at frame ${r.frame}, 0x${(r.addr ?? 0).toString(16)} (base ${r.baseline} vs opt ${r.optimized})`,
  );
  console.log(`  EQUAL/whole-machine: strict per-frame RAM identical over ${r.framesCompared} frames; fired ${fired}x`);
});

// -- 2. EQUAL (unit, both caller configs) -------------------------------------

function assertConfigEqual(label, hl) {
  const o = craft(hl, 0x5a, 0xc3); // oracle clone
  const p = craft(hl, 0x5a, 0xc3); // optimized clone
  const oc = o.cycles, pc = p.cycles;
  translated_3096(o);
  optimized_3096(p);

  const ram = firstStateDiff(o.dumpState(), p.dumpState(), (off) => o.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(o.regs, p.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(o.pc, p.pc, "pc must match");
  assert.equal(o.regs.sp, p.regs.sp, "SP must match (ret balance)");
  // RMW landed: both target bytes = mask ^ seed.
  assert.equal(p.mem.read8(hl), 0x81 ^ 0x5a, "first byte must be mask ^ seed0");
  assert.equal(p.mem.read8((hl + 4) & 0xffff), 0x81 ^ 0xc3, "second byte must be mask ^ seed1");
  assert.equal(p.cycles - pc, o.cycles - oc, "cycle total must match the oracle");
  console.log(`  EQUAL/unit ${label} (HL=0x${hl.toString(16)}): RAM + regs (incl F) + pc + SP identical`);
}

test("EQUAL (unit): config 1 -- HL=0x6909", () => assertConfigEqual("cfg1", CELL_0));
test("EQUAL (unit): config 2 -- HL=0x691d", () => assertConfigEqual("cfg2", CELL_1));

// -- 3. CYCLES (explicit total pin, single path) ------------------------------

test("CYCLES: sub_3096 charges the exact oracle total (96 t)", () => {
  const o = craft(CELL_0, 0x5a, 0xc3);
  const p = craft(CELL_0, 0x5a, 0xc3);
  const oc = o.cycles, pc = p.cycles;
  translated_3096(o);
  optimized_3096(p);
  const dO = o.cycles - oc, dP = p.cycles - pc;
  assert.equal(dO, ORACLE_CYCLES, `oracle total should be ${ORACLE_CYCLES} t`);
  assert.equal(dP, dO, `cycle total mismatch (oracle ${dO} t vs collapsed ${dP} t)`);
  console.log(`  CYCLES: oracle ${dO} t == collapsed ${dP} t`);
});

// -- 4. TEETH (value) ---------------------------------------------------------

/** Whole-machine value twin: corrupt EVERY store to 0x6909 (XOR extra 0xFF), so the
 *  sprite-attribute cell holds a persistently wrong value the strict gate must catch. */
function brokenValue(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  m.mem.write8 = (addr, value, busOffset) =>
    realWrite(addr, addr === CELL_0 ? value ^ 0xff : value, busOffset);
  try { return optimized_3096(m); } finally { m.mem.write8 = realWrite; }
}

test("TEETH (value, whole-machine): a wrong 0x6909 store is CAUGHT", () => {
  const r = wholeMachineEquivalence(drivenFactory, FRAMES, new Map([[TARGET, brokenValue]]));
  assert.equal(r.equal, false, "strict gate FAILED to catch a corrupted sprite-attribute store");
  console.log(`  TEETH/value: caught at frame ${r.frame}, 0x${(r.addr ?? 0).toString(16)} (base ${r.baseline} vs broken ${r.optimized})`);
});

test("TEETH (value, unit): a wrong 0x6909 store is CAUGHT and names 0x6909", () => {
  const o = craft(CELL_0, 0x5a, 0xc3);
  const b = craft(CELL_0, 0x5a, 0xc3);
  translated_3096(o);
  (function brokenUnit(m) {
    const realWrite = m.mem.write8.bind(m.mem);
    let broke = false;
    m.mem.write8 = (addr, value, busOffset) => {
      if (!broke && addr === CELL_0) { broke = true; return realWrite(addr, value ^ 0xff, busOffset); }
      return realWrite(addr, value, busOffset);
    };
    try { return optimized_3096(m); } finally { m.mem.write8 = realWrite; }
  })(b);
  const ram = firstStateDiff(o.dumpState(), b.dumpState(), (off) => o.stateOffsetToAddr(off));
  assert.ok(ram != null, "unit gate FAILED to catch a wrong store -- it is worthless");
  assert.equal(ram.addr, CELL_0, `expected first diff at 0x${CELL_0.toString(16)}, got 0x${(ram.addr ?? 0).toString(16)}`);
  console.log(`  TEETH/value/unit: caught at 0x${ram.addr.toString(16)} (oracle ${ram.a} vs broken ${ram.b})`);
});

// -- 5. TEETH (cycles) --------------------------------------------------------

/** Same behaviour as optimized, but the loop body charge is 5 t short each pass, so the
 *  path total no longer matches the oracle (96 -> 86). Deterministic teeth for the pin. */
function cyclebroken(m) {
  const { regs, mem } = m;
  regs.b = 0x02;
  m.step(0x3098, 7);
  do {
    regs.a = regs.c;
    regs.xor(mem.read8(regs.hl));
    mem.write8(regs.hl, regs.a);
    regs.addHl(regs.de);
    m.step(0x309c, 24); // DROPPED: the correct body charge is 29 t
    regs.djnz();
    m.step(regs.b !== 0 ? 0x3098 : 0x309e, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);
  m.ret();
}

test("TEETH (cycles, unit): a dropped m.step charge yields a wrong total and is CAUGHT", () => {
  const good = craft(CELL_0, 0x5a, 0xc3);
  const bad = craft(CELL_0, 0x5a, 0xc3);
  const gc = good.cycles, bc = bad.cycles;
  optimized_3096(good);
  cyclebroken(bad);
  assert.equal(good.cycles - gc, ORACLE_CYCLES, `the correct total is ${ORACLE_CYCLES} t`);
  assert.notEqual(bad.cycles - bc, good.cycles - gc, "cycle-total assertion has no teeth");
  console.log(`  TEETH/cycles/unit: correct ${good.cycles - gc} t vs dropped-charge ${bad.cycles - bc} t -- caught`);
});

test("TEETH (cycles, whole-machine): a dropped charge forks the PRNG and is CAUGHT", () => {
  const r = wholeMachineEquivalence(drivenFactory, FRAMES, new Map([[TARGET, cyclebroken]]));
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total (no PRNG fork observed)");
  console.log(`  TEETH/cycles/whole-machine: caught at frame ${r.frame}, 0x${(r.addr ?? 0).toString(16)}`);
});
