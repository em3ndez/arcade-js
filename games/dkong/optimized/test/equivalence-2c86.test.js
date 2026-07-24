// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for loc_2c86 (the "clear 0x6382, take the 0x638F:=3
 * entry" arm of the BONUS-event state machine).
 *
 * loc_2c86 is a LEAF reached only via `m.call(0x2c86)` — `jp nz,0x2c86` from
 * entry_2c03 (@ROM 0x2C20) and entry_2c41 (@ROM 0x2C46), which run inside the
 * interruptible per-frame update cascade loc_197a. The oracle docstring calls the
 * whole 0x2C.. cluster an unreachable frontier, but that is STALE: loc_197a is
 * translated and wired live, so loc_2c86 DISPATCHES NATURALLY — 5x in a 1200-frame
 * ATTRACT run (its first entry is ~frame 700, so the unit/branch captures run 1000
 * frames). Because it is on the interruptible cascade, its cycle collapse is licensed
 * by the CONVERGENT gate, not the strict byte-exact gate — same class as sub_0350.
 *
 * Jobs:
 *
 *   1. CONVERGENT (whole-machine, ATTRACT) -- the collapsed optimized loc_2c86
 *      CONVERGES vs the oracle: pixels ground truth, transient state/pixels OK if they
 *      reconverge, dead stack excluded. It fires 5x and is in fact byte-clean here (the
 *      34-cycle window is too small for the NMI to land inside on this trajectory).
 *
 *   2. EQUAL (unit) -- translated vs optimized leave identical RAM + full register
 *      file (incl. F, F3/F5) + pc from the captured natural entry. That entry drives
 *      loc_2c4f's ret-nz path (0x62B2=0x2A != C=0x30), so it also exercises the tail
 *      jump into loc_2c4f end-to-end.
 *
 *   3. CONTRACT + CYCLE coverage -- loc_2c86 is straight-line (ONE arm), so its single
 *      path is proven EQUAL with the block's exact cycle TOTAL pinned. To show the
 *      collapse holds regardless of what the tail callee does, all three DOWNSTREAM
 *      loc_2c4f paths are synthesised by identical-both-sides pokes and asserted EQUAL
 *      with their absolute totals: ret-nz 95 t, free-slot-exhausted 366 t, free-slot-
 *      found (-> entry_2c72) 200 t. Each independently pins loc_2c86's 34 t block (a
 *      dropped charge shifts all three).
 *
 *   4. CYCLE-TEETH (unit) -- a variant that drops loc_2c86's block charge by 5 t yields
 *      a wrong total and is CAUGHT, proving the cycle-total assertion has teeth.
 *
 *   5. TEETH (convergent) -- a cycle-broken twin (block charge 5 t short) forks the
 *      PRNG (0x6019 spin count -> 0x6018 seed): a PERSISTENT non-stack divergence,
 *      CAUGHT. This is the teeth for the collapse's load-bearing invariant
 *      (total-cycle preservation).
 *
 *   6. TEETH (unit) -- a broken twin whose store to 0x6382 lands the wrong value is
 *      CAUGHT and names 0x6382 (on the ret-nz entry loc_2c4f never rewrites 0x6382, so
 *      the corruption survives to the dump).
 *
 * NO write-trace test: loc_2c86's only store is 0x6382 (WORK RAM 0x6000-0x6BFF), not
 * a 0x7Dxx/0x7Cxx hardware latch, so there is no bus cycle to pin.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2c86 as translated_2c86 } from "../../translated/state0.js";
import { loc_2c86 as optimized_2c86 } from "../loc_2c86.js";
import { unitEquivalence } from "../harness.js";
import { convergentGate, SCENARIOS } from "./convergent.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { Machine } from "../../machine.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2c86;
const EVENT_FLAG = 0x6382;   // ram.js placeholder SCRATCH_6382 -- the event-flag byte this arm clears
const BONUS_EVENT_MARK = 0x62b2; // ram.js BONUS_EVENT_MARK -- loc_2c4f's (0x62B2)==C gate
const MAX_FRAMES = 1000;     // loc_2c86 first enters ~frame 700 in attract

// loc_2c86's only store is to 0x6382; the broken twin corrupts exactly that store.
const BROKEN_ADDR = EVENT_FLAG;

/**
 * Deliberately-broken twin: the optimized routine EXCEPT the first store to 0x6382
 * lands a wrong value (correct value XOR 0xFF, guaranteed to differ). Control flow and
 * the tail call are untouched -- the gate catches a "wrong value to the routine's own
 * output address" bug, not a control-flow bug.
 */
function broken_2c86(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke && addr === BROKEN_ADDR) {
      broke = true;
      return realWrite(addr, value ^ 0xff, busOffset);
    }
    return realWrite(addr, value, busOffset);
  };
  try {
    return optimized_2c86(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

/**
 * Cycle-broken twin for the CONVERGENT gate: identical memory + registers to the
 * collapsed routine, but the block charge is 5 t short, so the block total no longer
 * matches the oracle. A wrong total shifts the main loop's spin count (0x6019, the PRNG
 * entropy) on each of loc_2c86's 5 attract dispatches, forking the RANDOM stream
 * permanently: a PERSISTENT non-stack divergence, never a heal.
 */
function cyclebroken_2c86(m) {
  const { regs, mem } = m;
  regs.a = 0x00;
  mem.write8(EVENT_FLAG, regs.a);
  regs.a = 0x03;
  m.step(0x2c4f, 29); // DROPPED: the correct block charge is 34 t
  return m.call(0x2c4f);
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine, attract): collapsed loc_2c86 CONVERGES vs translated", () => {
  // loc_2c86 is COLLAPSED and on the INTERRUPTIBLE loc_197a cascade, so the strict gate
  // could false-fail on a mistimed-NMI tear / dead-stack PC. The convergent gate is the
  // license: pixels ground truth, transient state/pixels OK if they reconverge, dead
  // stack excluded, persistent divergence fails. It dispatches naturally in ATTRACT.
  const r = convergentGate(new Map([[TARGET, optimized_2c86]]), { scenario: SCENARIOS.attract });

  assert.ok(
    r.invocations.get(TARGET) >= 1,
    `override at 0x${TARGET.toString(16)} never dispatched (invocations=${r.invocations.get(TARGET)})`,
  );
  assert.equal(
    r.pass,
    true,
    r.pass ? "" : `NOT convergent: persistent state ${JSON.stringify(r.statePersistent)}, ` +
      `pixelPersistent=${r.pixelPersistent}`,
  );
  console.log(
    `  CONVERGENT: pass, fired ${r.invocations.get(TARGET)}x; ` +
      `${r.pixDiffFrames} tear frame(s) (max ${r.maxPixels}px, healed), ` +
      `non-stack state persistent = ${r.statePersistent.length}`,
  );
});

test("EQUAL (unit): idiomatic optimized loc_2c86 matches translated in RAM + registers", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_2c86, optimized_2c86, { maxFrames: MAX_FRAMES });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F, F3/F5) + pc identical (natural ret-nz entry)");
});

// -- CONTRACT + CYCLE COVERAGE -----------------------------------------------

/** Capture the pristine machine the instant loc_2c86 is first entered (via m.call).
 *  A constructor override snapshots the entry, then delegates to the oracle so the
 *  host run proceeds normally to a clean stop. */
function captureEntry(maxFrames = MAX_FRAMES) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_2c86(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}

/** Clone `entry`, apply identical pokes, run `fn`, and report the full contract. */
function runBranch(entry, pokes, fn) {
  const c = entry.clone();
  for (const [addr, val] of pokes) c.mem.write8(addr, val);
  const c0 = c.cycles;
  const ret = fn(c);
  return { ret, cycles: c.cycles - c0, sp: c.regs.sp, pc: c.pc, machine: c };
}

/** Prove one synthesised downstream path EQUAL across the whole contract: RAM,
 *  registers, pc, SP, and the absolute cycle total (structural -- teeth for the
 *  collapsed 34 t block). */
function assertPathEqual(label, pokes, expect) {
  const entry = captureEntry();
  const o = runBranch(entry, pokes, translated_2c86);
  const p = runBranch(entry, pokes, optimized_2c86);

  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(o.machine.regs, p.machine.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(o.pc, p.pc, "pc must match between oracle and optimized");
  assert.equal(o.sp, p.sp, "SP must match the oracle");
  assert.equal(o.cycles, p.cycles, "cycle total must match the oracle");
  assert.equal(o.cycles, expect.cycles, `oracle cycle total should be ${expect.cycles} on this path`);
  console.log(
    `  CONTRACT/${label}: EQUAL -- SP 0x${p.sp.toString(16)}, ${p.cycles} t, ` +
      `0x6382=${p.machine.mem.read8(EVENT_FLAG)}, 0x638f=${p.machine.mem.read8(0x638f)}`,
  );
}

test("CONTRACT (unit): natural ret-nz path -- 0x62B2 != C, tail loc_2c4f ret nz, 95 t", () => {
  // The natural captured entry (C=0x30, 0x62B2=0x2A) already takes this path; no poke.
  assertPathEqual("ret-nz", [], { cycles: 95 });
});

test("CONTRACT (unit): free-slot-exhausted path -- 0x62B2 == C, all 5 records nonzero, 366 t", () => {
  // Force loc_2c4f past its (0x62B2)==C gate, then make the five 0x6400/stride-0x20
  // records all nonzero so the scan exhausts and rets at 0x2C71.
  const entry = captureEntry();
  const C = entry.regs.c;
  const pokes = [[BONUS_EVENT_MARK, C]];
  for (let i = 0; i < 5; i++) pokes.push([0x6400 + i * 0x20, 0x01]);
  const o = runBranch(entry, pokes, translated_2c86);
  const p = runBranch(entry, pokes, optimized_2c86);
  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  assert.equal(firstRegDiff(o.machine.regs, p.machine.regs), null, "regs must match");
  assert.equal(o.pc, p.pc, "pc must match");
  assert.equal(o.sp, p.sp, "SP must match");
  assert.equal(o.cycles, p.cycles, "cycle total must match the oracle");
  assert.equal(o.cycles, 366, "oracle cycle total should be 366 t on the exhausted path");
  console.log(`  CONTRACT/exhaust: EQUAL -- ${p.cycles} t, 0x6382=${p.machine.mem.read8(EVENT_FLAG)}`);
});

test("CONTRACT (unit): free-slot-found path -- 0x62B2 == C, record0 zero -> entry_2c72, 200 t", () => {
  // Force the gate, then zero the first record so the scan finds a free slot and tail-
  // calls entry_2c72 (which sets bit 7 of 0x6382 -> 0x80, over loc_2c86's clear-to-0).
  const entry = captureEntry();
  const C = entry.regs.c;
  const pokes = [[BONUS_EVENT_MARK, C], [0x6400, 0x00]];
  const o = runBranch(entry, pokes, translated_2c86);
  const p = runBranch(entry, pokes, optimized_2c86);
  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  assert.equal(firstRegDiff(o.machine.regs, p.machine.regs), null, "regs must match");
  assert.equal(o.pc, p.pc, "pc must match");
  assert.equal(o.sp, p.sp, "SP must match");
  assert.equal(o.cycles, p.cycles, "cycle total must match the oracle");
  assert.equal(o.cycles, 200, "oracle cycle total should be 200 t on the free-slot path");
  assert.equal(p.machine.mem.read8(EVENT_FLAG), 0x80, "entry_2c72 should have set bit 7 of 0x6382");
  console.log(`  CONTRACT/freeslot: EQUAL -- ${p.cycles} t, 0x6382=0x${p.machine.mem.read8(EVENT_FLAG).toString(16)}`);
});

test("CYCLE-TEETH (unit): a dropped block charge yields a wrong total and is CAUGHT", () => {
  const entry = captureEntry();
  const good = runBranch(entry, [], optimized_2c86);
  const dropped = runBranch(entry, [], (m) => {
    const { regs, mem } = m;
    regs.a = 0x00;
    mem.write8(EVENT_FLAG, regs.a);
    regs.a = 0x03;
    m.step(0x2c4f, 29); // block charge 5 t short
    return m.call(0x2c4f);
  });
  assert.equal(good.cycles, 95, "the correct ret-nz total is 95 t");
  assert.notEqual(dropped.cycles, good.cycles, "cycle-total assertion has no teeth");
  console.log(`  CYCLE-TEETH: correct 95 t vs dropped-charge ${dropped.cycles} t -- caught`);
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_2c86]]), { scenario: SCENARIOS.attract });

  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.pass, false, "convergent gate FAILED to catch a wrong cycle total -- it is worthless");
  assert.ok(
    r.statePersistent.length > 0 || r.pixelPersistent,
    "a caught divergence must be persistent (non-stack state or pixels)",
  );
  console.log(
    `  TEETH/convergent: caught -- persistent non-stack addrs ${r.statePersistent.length}` +
      `${r.statePersistent.length ? " (" + r.statePersistent.slice(0, 4).map((s) => "0x" + s.addr.toString(16)).join(",") + ")" : ""}, ` +
      `pixelPersistent ${r.pixelPersistent}`,
  );
});

test("TEETH (unit): a wrong 0x6382 store is CAUGHT and names 0x6382", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_2c86, broken_2c86, { maxFrames: MAX_FRAMES });

  assert.equal(r.equal, false, "harness FAILED to catch a wrong store -- it is worthless");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  assert.equal(
    r.ram.addr,
    BROKEN_ADDR,
    `expected first diff at the broken address 0x${BROKEN_ADDR.toString(16)}, got 0x${r.ram.addr.toString(16)}`,
  );
  console.log(
    `  TEETH/unit: caught at 0x${r.ram.addr.toString(16)} ` +
      `(translated ${r.ram.a} vs broken ${r.ram.b})`,
  );
});
