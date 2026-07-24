// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for arm_1a4b -- the 3-instruction "arm the edge-item pickup"
 * routine (sets flag 0x6291 = 1). See optimized/arm_1a4b.js for the full behaviour.
 *
 * GATE: CRAFTED ENTRY. arm_1a4b is UNREACHABLE by the drivable whole-machine
 * scenarios -- its only caller sub_1a33 fires ~198x over a 2000-frame gameplay run,
 * but the player never stands on an exact screen-edge column (MARIO_X 0x4B/0xB3), so
 * arm_1a4b dispatches 0x (measured). It is also INTERRUPTIBLE (sub_1a33 <- loc_197a's
 * non-atomic cascade). So there is no natural/convergent run to gate against; instead
 * a real machine entry is captured (at loc_0fd7's dispatch -- deterministic in attract
 * within 600 frames, the sub_13ca pattern), cloned, and oracle vs optimized are run on
 * the two clones and diffed on RAM + full register file + pc + SP. arm_1a4b reads
 * NOTHING (its store is unconditional; the edge test lives in the caller), so its
 * transform is entry-independent -- any valid captured entry proves it, and this one
 * gives a realistic SP + running cycle counter for the `ret` and the cycle-total pin.
 *
 * Because no whole-machine run covers it, the collapsed-cycle PRNG gate does not apply;
 * the routine is kept PER-INSTRUCTION (7/13/10 t), not collapsed, and the CYCLES test
 * pins its total (30 t) against the oracle EXPLICITLY (docs/06: a crafted-entry-only
 * routine must assert its cycle total, since no downstream run would catch a wrong one).
 *
 * FULL-BRANCH COVERAGE is trivial: arm_1a4b is straight-line with NO data-dependent
 * branch, so its single path is its only path.
 *
 * Four jobs:
 *   1. EQUAL  -- optimized == oracle in RAM + registers (incl. F, A, HL, SP) + pc.
 *   2. CYCLES -- the exact oracle total (30 t) is charged.
 *   3. TEETH (value)  -- a wrong 0x6291 store is CAUGHT and names 0x6291.
 *   4. TEETH (cycles) -- a dropped m.step charge yields a wrong total and is CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0fd7 as translated_0fd7 } from "../../translated/state0.js";
import { arm_1a4b as translated_1a4b } from "../../translated/state0.js";
import { arm_1a4b as optimized_1a4b } from "../arm_1a4b.js";
import { Machine } from "../../machine.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const ARMED_FLAG = 0x6291; // unnamed in ram.js (SCRATCH_6291); proposed EDGE_PICKUP_ARMED
const FRAMES = 600;        // loc_0fd7 dispatches in attract well within this (see sub_13ca)
const ORACLE_CYCLES = 30;  // 7 (ld a,n) + 13 (ld (nn),a) + 10 (ret)

/** Capture a real machine the instant loc_0fd7 is first dispatched (deterministic in
 *  attract). arm_1a4b reads nothing, so this entry state is representative of any --
 *  it just supplies a valid SP (a return address for `ret`) and a live cycle counter. */
function captureEntry() {
  let entry = null;
  const snap = new Map([[0x0fd7, (mm) => { if (entry === null) entry = mm.clone(); return translated_0fd7(mm); }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(FRAMES);
  if (entry === null) throw new Error("loc_0fd7 never entered -- cannot craft an arm_1a4b entry");
  return entry;
}
const ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Clone the entry, run `fn`, and report the resulting machine + the cycles it charged
 *  (relative to entry, so the total is base-independent). */
function runOne(fn) {
  const c = ENTRY.clone();
  const c0 = c.cycles;
  fn(c);
  return { machine: c, cycles: c.cycles - c0, sp: c.regs.sp, pc: c.pc };
}

/** A deliberately-broken twin: the first store to 0x6291 lands the wrong value
 *  (correct XOR 0xFF -> guaranteed to differ), everything else verbatim. */
function broken_1a4b(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke && addr === ARMED_FLAG) { broke = true; return realWrite(addr, value ^ 0xff, busOffset); }
    return realWrite(addr, value, busOffset);
  };
  try { return optimized_1a4b(m); } finally { m.mem.write8 = realWrite; }
}

/** A cycle-broken twin: identical state, but the `ld (nn),a` charge is dropped, so the
 *  path total no longer matches the oracle. Teeth for the explicit cycle-total pin. */
function cyclebroken_1a4b(m) {
  const { regs, mem } = m;
  regs.a = 0x01;
  m.step(0x1a4d, 7);
  mem.write8(ARMED_FLAG, regs.a);
  m.step(0x1a50, 0); // DROPPED: the correct charge here is 13 t
  m.ret(10);
}

// -- EQUAL --------------------------------------------------------------------

test("EQUAL (crafted entry): arm_1a4b matches translated in RAM + registers + pc + SP", () => {
  const o = runOne(translated_1a4b);
  const p = runOne(optimized_1a4b);

  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(o.machine.regs, p.machine.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(o.pc, p.pc, "pc must match");
  assert.equal(o.sp, p.sp, "SP must match (ret stack balance)");
  assert.equal(
    p.machine.mem.read8(ARMED_FLAG), 1,
    "arm_1a4b must leave 0x6291 = 1 (the armed flag)",
  );
  assert.equal(p.machine.regs.a, 1, "A must be 1 on return (register file compared)");
  console.log(
    `  EQUAL: RAM + all registers (incl. F, A, HL, SP) + pc identical; 0x6291=${p.machine.mem.read8(ARMED_FLAG)}, A=${p.machine.regs.a}`,
  );
});

// -- CYCLES (crafted-entry-only, so pin the total explicitly) -----------------

test("CYCLES: arm_1a4b charges the exact oracle total (30 t, per-instruction)", () => {
  const o = runOne(translated_1a4b);
  const p = runOne(optimized_1a4b);
  assert.equal(o.cycles, ORACLE_CYCLES, `oracle total should be ${ORACLE_CYCLES} t`);
  assert.equal(p.cycles, o.cycles, `cycle total mismatch (oracle ${o.cycles} t vs optimized ${p.cycles} t)`);
  console.log(`  CYCLES: oracle ${o.cycles} t == optimized ${p.cycles} t`);
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (value): a wrong 0x6291 store is CAUGHT and names 0x6291", () => {
  const o = runOne(translated_1a4b);
  const b = runOne(broken_1a4b);
  const ram = firstStateDiff(o.machine.dumpState(), b.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.ok(ram != null, "harness FAILED to catch a wrong store -- it is worthless");
  assert.equal(
    ram.addr, ARMED_FLAG,
    `expected first diff at 0x${ARMED_FLAG.toString(16)}, got 0x${(ram.addr ?? 0).toString(16)}`,
  );
  console.log(`  TEETH/value: caught at 0x${ram.addr.toString(16)} (translated ${ram.a} vs broken ${ram.b})`);
});

test("TEETH (cycles): a dropped m.step charge yields a wrong total and is CAUGHT", () => {
  const good = runOne(optimized_1a4b);
  const dropped = runOne(cyclebroken_1a4b);
  assert.equal(good.cycles, ORACLE_CYCLES, `the correct total is ${ORACLE_CYCLES} t`);
  assert.notEqual(dropped.cycles, good.cycles, "cycle-total assertion has no teeth");
  console.log(`  TEETH/cycles: correct ${good.cycles} t vs dropped-charge ${dropped.cycles} t -- caught`);
});
