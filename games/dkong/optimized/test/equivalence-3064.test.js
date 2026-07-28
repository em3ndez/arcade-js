// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_3064 -- a straight-line LEAF that copies one byte from
 * (HL+BC) to (HL+BC+DE), threading HL through two 16-bit adds (see optimized/sub_3064.js).
 * Its lone caller sub_304a invokes it twice per call to slide two tilemap rows one row up
 * (HL=0x7600 then HL=0x75C0, BC=the 0x638E index, DE=0xFFE0 = -0x20 = one 32-col row).
 *
 * GATE: STRICT WHOLE-MACHINE (byte-exact), driven -- plus a unit crafted-entry pair.
 * MEASURED reachability (the routine dispatches during the coin-insert screen-slide, NOT
 * plain attract): under a coin+start tape sub_3064 dispatches 42x over 700 frames (first at
 * frame 116), and io.nmiMask == 0 at 100% of those 42 dispatches -> ATOMIC (the slide runs
 * inside the NMI game-state cascade, mask cleared on entry), so the vblank NMI cannot land
 * inside the routine and the per-block cycle fold cannot push a coarse mid-routine PC.
 * An atomic byte-exact collapse passes the ordinary STRICT gate (docs/decompiler-pipeline -- the CONVERGENT
 * gate is only for INTERRUPTIBLE collapses), and being non-vacuous (42 invocations) the
 * strict per-frame RAM diff also covers the cycle total through the spin-count / stack
 * channel (verified: a dropped charge forks the trace at frame 117, stack 0x6BF4).
 *
 * CONTROL-FLOW ARMS: sub_3064 is straight-line -- add hl,bc / ld a,(hl) / add hl,de /
 * ld (hl),a / ret, with no data-dependent branch. Its SINGLE path is its only arm. The two
 * caller configs (HL=0x7600, HL=0x75C0) are its ONLY two live entries; both run that single
 * path and both are covered by real captured-dispatch entries (BC=0x1F, DE=0xFFE0 --
 * so src/dst = 0x761F->0x75FF and 0x75DF->0x75BF respectively).
 *
 * Jobs:
 *   1. EQUAL (whole-machine, strict) -- optimized == oracle across the full per-frame RAM
 *      trace of a coin+start run; the override must fire 42x (non-vacuous).
 *   2. EQUAL (unit, both caller configs) -- crafted entries captured at the REAL dispatch
 *      prove RAM + full register file (incl. F) + pc + SP identical for HL=0x7600 and
 *      HL=0x75C0, and that the byte actually landed at (HL+BC+DE).
 *   3. CYCLES (unit) -- the exact oracle total (46 t = 11+7+11+7 block + 10 ret) is charged
 *      on both configs (explicit pin over the strict gate's PRNG coverage; this is a
 *      cycle-COLLAPSED routine so the per-arm total must be preserved).
 *   4. TEETH (value) -- a wrong copied byte is CAUGHT (whole-machine: a persistently wrong
 *      slide; unit: named first-diff at the (HL+BC+DE) destination).
 *   5. TEETH (cycles) -- a dropped m.step charge yields a wrong total, CAUGHT both by the
 *      deterministic unit pin and by the strict whole-machine PRNG/stack fork.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_3064 as translated_3064 } from "../../translated/sub_3064.js";
import { sub_3064 as optimized_3064 } from "../sub_3064.js";
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

const TARGET = 0x3064;
const ORACLE_CYCLES = 46; // 11 (add hl,bc) + 7 (ld a,(hl)) + 11 (add hl,de) + 7 (ld (hl),a) + 10 (ret) -- measured
const CFG1 = 0x7600; // sub_304a's first call -- slide row at 0x7600
const CFG2 = 0x75c0; // sub_304a's second call -- slide row at 0x75C0

// A coin+start tape that credits a game and plays the coin-insert screen-slide, where all
// 42 sub_3064 dispatches occur (first at ~frame 116). 700 frames leaves a long tail for a
// wrong value or cycle total to fork the state / spin count (0x6019 PRNG) and surface.
const TAPE = [
  { port: 0x7d00, bits: 0x80, frame: 10, dur: 6 }, // coin  (IN2 bit7)
  { port: 0x7d00, bits: 0x04, frame: 30, dur: 6 }, // start (IN2 bit2)
];
const FRAMES = 700;
const makeMachine = (overrides) => {
  const m = new Machine(ROM, overrides ? { overrides } : {});
  m.inputTape = TAPE.map((t) => ({ ...t }));
  return m;
};

// -- capture the REAL pristine entry state of each caller config's FIRST dispatch --------
const CAPTURE_FRAMES = 200; // all 42 dispatches (both configs) occur by ~frame 130
function captureEntries() {
  const entries = new Map();
  const snap = new Map([[TARGET, (mm) => {
    const hl = mm.regs.hl & 0xffff;
    if (!entries.has(hl)) entries.set(hl, mm.clone()); // pristine, pre-execution
    return translated_3064(mm); // let the host run proceed to a clean stop
  }]]);
  const host = makeMachine(snap);
  host.runFrames(CAPTURE_FRAMES);
  if (!entries.has(CFG1) || !entries.has(CFG2)) {
    throw new Error(
      `sub_3064 entries not captured (have [${[...entries.keys()].map((h) => h.toString(16))}]) ` +
        "-- expected both 0x7600 and 0x75c0",
    );
  }
  return entries;
}
const ENTRIES = ROM_PRESENT ? captureEntries() : null;

/** The destination address the routine writes: (HL + BC + DE) & 0xffff, from the entry. */
function destOf(entry) {
  return (entry.regs.hl + entry.regs.bc + entry.regs.de) & 0xffff;
}

// -- 1. EQUAL (whole-machine, strict) -----------------------------------------

test("EQUAL (whole-machine strict): optimized sub_3064 matches oracle over a driven run", () => {
  const r = wholeMachineEquivalence(makeMachine, FRAMES, new Map([[TARGET, optimized_3064]]));
  const fired = r.invocations.get(TARGET);
  assert.ok(fired >= 1, `override at 0x${TARGET.toString(16)} never dispatched (invocations=${fired})`);
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `NOT equal at frame ${r.frame}, 0x${(r.addr ?? 0).toString(16)} (base ${r.baseline} vs opt ${r.optimized})`,
  );
  assert.equal(r.framesCompared, FRAMES);
  console.log(`  EQUAL/whole-machine: strict per-frame RAM identical over ${r.framesCompared} frames; fired ${fired}x`);
});

// -- 2. EQUAL (unit, both caller configs -- the routine's single path) --------

function assertConfigEqual(label, hl) {
  const entry = ENTRIES.get(hl);
  const o = entry.clone(); // oracle
  const p = entry.clone(); // optimized
  const dest = destOf(entry);
  const src = (entry.regs.hl + entry.regs.bc) & 0xffff;
  const expectByte = p.mem.read8(src); // the byte the copy must move to `dest`
  const oc = o.cycles, pc = p.cycles;
  translated_3064(o);
  optimized_3064(p);

  const ram = firstStateDiff(o.dumpState(), p.dumpState(), (off) => o.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(o.regs, p.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(o.pc, p.pc, "pc must match");
  assert.equal(o.regs.sp, p.regs.sp, "SP must match (ret balance)");
  // The copy landed: the destination byte now holds the source byte.
  assert.equal(p.mem.read8(dest), expectByte, `byte must be copied to 0x${dest.toString(16)}`);
  assert.equal(p.cycles - pc, o.cycles - oc, "cycle total must match the oracle");
  console.log(
    `  EQUAL/unit ${label} (HL=0x${hl.toString(16)}, BC=0x${(entry.regs.bc & 0xffff).toString(16)}, ` +
      `0x${src.toString(16)}->0x${dest.toString(16)}): RAM + regs (incl F) + pc + SP identical`,
  );
}

test("EQUAL (unit): config 1 -- HL=0x7600", () => assertConfigEqual("cfg1", CFG1));
test("EQUAL (unit): config 2 -- HL=0x75c0", () => assertConfigEqual("cfg2", CFG2));

// -- 3. CYCLES (explicit total pin, single path) ------------------------------

test("CYCLES: sub_3064 charges the exact oracle total (46 t) on both configs", () => {
  for (const [label, hl] of [["cfg1", CFG1], ["cfg2", CFG2]]) {
    const entry = ENTRIES.get(hl);
    const o = entry.clone();
    const p = entry.clone();
    const oc = o.cycles, pc = p.cycles;
    translated_3064(o);
    optimized_3064(p);
    const dO = o.cycles - oc, dP = p.cycles - pc;
    assert.equal(dO, ORACLE_CYCLES, `oracle total should be ${ORACLE_CYCLES} t`);
    assert.equal(dP, dO, `${label}: cycle total mismatch (oracle ${dO} t vs collapsed ${dP} t)`);
    console.log(`  CYCLES/${label}: oracle ${dO} t == collapsed ${dP} t`);
  }
});

// -- 4. TEETH (value) ---------------------------------------------------------

/** Whole-machine value twin: corrupt EVERY store (XOR 0xFF), so the slide lands wrong
 *  bytes the strict gate must catch. */
function brokenValue(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  m.mem.write8 = (addr, value, busOffset) => realWrite(addr, value ^ 0xff, busOffset);
  try { return optimized_3064(m); } finally { m.mem.write8 = realWrite; }
}

test("TEETH (value, whole-machine): a wrong copied byte is CAUGHT", () => {
  const r = wholeMachineEquivalence(makeMachine, FRAMES, new Map([[TARGET, brokenValue]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a corrupted slide byte");
  console.log(`  TEETH/value: caught at frame ${r.frame}, 0x${(r.addr ?? 0).toString(16)} (base ${r.baseline} vs broken ${r.optimized})`);
});

test("TEETH (value, unit): a wrong copied byte is CAUGHT and names the (HL+BC+DE) destination", () => {
  const entry = ENTRIES.get(CFG1);
  const dest = destOf(entry);
  const o = entry.clone();
  const b = entry.clone();
  translated_3064(o);
  (function brokenUnit(m) {
    const realWrite = m.mem.write8.bind(m.mem);
    let broke = false;
    m.mem.write8 = (addr, value, busOffset) => {
      if (!broke) { broke = true; return realWrite(addr, value ^ 0xff, busOffset); }
      return realWrite(addr, value, busOffset);
    };
    try { return optimized_3064(m); } finally { m.mem.write8 = realWrite; }
  })(b);
  const ram = firstStateDiff(o.dumpState(), b.dumpState(), (off) => o.stateOffsetToAddr(off));
  assert.ok(ram != null, "unit gate FAILED to catch a wrong store -- it is worthless");
  assert.equal(ram.addr, dest, `expected first diff at 0x${dest.toString(16)}, got 0x${(ram.addr ?? 0).toString(16)}`);
  console.log(`  TEETH/value/unit: caught at 0x${ram.addr.toString(16)} (oracle ${ram.a} vs broken ${ram.b})`);
});

// -- 5. TEETH (cycles) --------------------------------------------------------

/** Same behaviour as optimized, but the collapsed block charge is 10 t short (36 -> 26), so
 *  the path total no longer matches the oracle (46 -> 36). Deterministic teeth for the pin,
 *  and (whole-machine) a PRNG/stack fork for the strict gate. */
function cyclebroken(m) {
  const { regs, mem } = m;
  regs.addHl(regs.bc);
  regs.a = mem.read8(regs.hl);
  regs.addHl(regs.de);
  mem.write8(regs.hl, regs.a);
  m.step(0x3068, 26); // DROPPED: the correct block total is 36 t
  m.ret();
}

test("TEETH (cycles, unit): a dropped m.step charge yields a wrong total and is CAUGHT", () => {
  const entry = ENTRIES.get(CFG1);
  const good = entry.clone();
  const bad = entry.clone();
  const gc = good.cycles, bc = bad.cycles;
  optimized_3064(good);
  cyclebroken(bad);
  assert.equal(good.cycles - gc, ORACLE_CYCLES, `the correct total is ${ORACLE_CYCLES} t`);
  assert.notEqual(bad.cycles - bc, good.cycles - gc, "cycle-total assertion has no teeth");
  console.log(`  TEETH/cycles/unit: correct ${good.cycles - gc} t vs dropped-charge ${bad.cycles - bc} t -- caught`);
});

test("TEETH (cycles, whole-machine): a dropped charge forks the PRNG/stack and is CAUGHT", () => {
  const r = wholeMachineEquivalence(makeMachine, FRAMES, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total (no fork observed)");
  console.log(`  TEETH/cycles/whole-machine: caught at frame ${r.frame}, 0x${(r.addr ?? 0).toString(16)}`);
});
