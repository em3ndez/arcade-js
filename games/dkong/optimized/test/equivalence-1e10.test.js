// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_1e10 -- the board-completion setter arm B=0x7F /
 * DE=0x0008 that falls through into the shared continuation loc_1e15.  See
 * optimized/loc_1e10.js for the routine and the cycle/name decisions.
 *
 * GATE: CRAFTED-ENTRY.  loc_1e10 runs only during a real board completion, deep
 * in the INTERRUPTIBLE per-frame dispatch cascade (loc_127c -> sub_1dbd ->
 * loc_1dc9), and is measured UNREACHABLE by every available whole-machine
 * scenario: 0 dispatches over attract 1200 & 4000 frames and the standard
 * gameplay tape.  So there is no natural/convergent whole-machine run to gate it,
 * and (being interruptible + unverifiable) it is kept PER-INSTRUCTION rather than
 * collapsed.  Its charges are byte-identical to the oracle, but the tests still
 * pin the exact 17 t total with teeth, per docs/decompiler-pipeline's crafted-entry rule.
 *
 * loc_1e10's ENTIRE observable footprint is: regs B:=0x7F, DE:=0x0008; pc->0x1E15;
 * +17 t; and NOTHING else (no RAM write, no stack op, no flag write).  It has no
 * data-dependent branches -- one straight-line path -- so full-branch coverage IS
 * that single path.  The tests prove it two complementary ways:
 *
 *   1. ISOLATED (stub 0x1E15): a recording stub stands in for the continuation so
 *      loc_1e10's own effect is observed exactly and entry-independently -- the
 *      register file it delivers to 0x1E15, the pc, the untouched SP, and the 17 t.
 *   2. REAL DOWNSTREAM (crafted entry): boot the machine, point (0x6343) at a
 *      benign work-RAM record so loc_1e15's `ld hl,(0x6343)` / `ld (hl),0` stay in
 *      RAM, then run the FULL real chain (loc_1e15 -> sub_309f -> loc_1e36 -> ...)
 *      through the live registry.  Oracle vs optimized must leave identical RAM +
 *      registers + pc, and the run confirms B flows to 0x6A31 (== 0x7F).
 *
 * TEETH: a dropped cycle charge yields 7 t != 17 t (caught); a wrong B value lands
 * 0x00 in the 0x6A31 record instead of 0x7F (caught, named at 0x6A31).
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_1e10 as translated_1e10 } from "../../translated/state0.js";
import { loc_1e10 as optimized_1e10 } from "../loc_1e10.js";
import { Machine } from "../../machine.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1e10;
const CONT = 0x1e15; // the continuation loc_1e10 falls through into
const BONUS_B = 0x7f; // the (B) parameter this arm selects
const BONUS_DE = 0x0008; // the (DE) parameter this arm selects
const OWN_CYCLES = 17; // loc_1e10's own charge: ld b,0x7f (7) + ld de,0x0008 (10)
const RECORD_B = 0x6a31; // loc_1e36 writes B here (byte 1 of the 0x6A30 record)

// ---------------------------------------------------------------------------
// ISOLATED: a recording stub at 0x1E15 stands in for the continuation, so we see
// loc_1e10's OWN exit state (the register file + pc it hands over) with no
// dependence on downstream RAM.  Both oracle and optimized route their
// `m.call(0x1e15)` through this same stub (installed via the routine registry).
// ---------------------------------------------------------------------------

/** Build a machine whose 0x1E15 is a recording stub; boot it a little so the
 *  register file is realistic; return { machine, seen } where `seen` is filled by
 *  the stub with the state at the instant loc_1e10 transfers control. */
function isolatedHost() {
  const seen = {};
  const stub = (mm) => {
    seen.b = mm.regs.b;
    seen.de = mm.regs.de;
    seen.sp = mm.regs.sp;
    seen.pc = mm.pc;
    seen.f = mm.regs.f;
    // charge nothing: we want loc_1e10's own cycle delta, not the continuation's.
  };
  const m = new Machine(ROM, { overrides: new Map([[CONT, stub]]) });
  m.runFrames(80);
  return { entry: m, seen };
}

/** Run `fn` on a fresh clone with B/DE pre-dirtied (to prove the routine writes
 *  them), returning the recorded hand-over plus the cycle delta and dumpState. */
function runIsolated(host, fn) {
  const c = host.entry.clone();
  c.regs.b = 0x11;      // dirty -> must become 0x7F
  c.regs.de = 0x2222;   // dirty -> must become 0x0008
  const spBefore = c.regs.sp;
  const c0 = c.cycles;
  fn(c);
  return { seen: { ...host.seen }, cycles: c.cycles - c0, spBefore, machine: c };
}

test("EQUAL (isolated): optimized loc_1e10 hands 0x1E15 the same register file as the oracle", () => {
  const host = isolatedHost();
  const o = runIsolated(host, translated_1e10);
  const p = runIsolated(host, optimized_1e10);

  // The hand-over the continuation sees must be identical.
  assert.deepEqual(p.seen, o.seen, "register file delivered to 0x1E15 differs from the oracle");
  // And the full machine state after the routine (no RAM writes, so this is really
  // a register-file + pc equality) must match too.
  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(o.machine.regs, p.machine.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(o.machine.pc, p.machine.pc, "pc must match");
  console.log(`  EQUAL/isolated: hand-over B=0x${p.seen.b.toString(16)} DE=0x${p.seen.de.toString(16)} pc=0x${p.seen.pc.toString(16)}, identical to oracle`);
});

test("CONTRACT (isolated): B=0x7F, DE=0x0008, pc->0x1E15, SP untouched, exactly 17 t", () => {
  const host = isolatedHost();
  const p = runIsolated(host, optimized_1e10);

  assert.equal(p.seen.b, BONUS_B, "B must be 0x7F");
  assert.equal(p.seen.de, BONUS_DE, "DE must be 0x0008");
  assert.equal(p.seen.pc, CONT, "pc must transfer to 0x1E15 (the fall-through target)");
  assert.equal(p.seen.sp, p.spBefore, "loc_1e10 must not touch SP");
  assert.equal(p.cycles, OWN_CYCLES, `loc_1e10's own cycle total must be ${OWN_CYCLES} t`);
  console.log(`  CONTRACT: B=0x7F DE=0x0008 pc=0x1E15 SP untouched, ${p.cycles} t`);
});

test("TEETH (cycles): a dropped m.step charge yields a wrong total and is CAUGHT", () => {
  const host = isolatedHost();
  const good = runIsolated(host, optimized_1e10);
  // Twin identical in memory/registers but the 10 t `ld de` charge is dropped.
  const droppedCharge = (m) => {
    const { regs } = m;
    regs.b = 0x7f; m.step(0x1e12, 7);
    regs.de = 0x0008; m.step(0x1e15, 0); // DROPPED: correct charge is 10 t
    return m.call(CONT);
  };
  const bad = runIsolated(host, droppedCharge);
  assert.equal(good.cycles, OWN_CYCLES, "the correct total is 17 t");
  assert.notEqual(bad.cycles, good.cycles, "cycle-total assertion has no teeth");
  console.log(`  TEETH/cycles: correct ${good.cycles} t vs dropped-charge ${bad.cycles} t -- caught`);
});

// ---------------------------------------------------------------------------
// REAL DOWNSTREAM: run the actual loc_1e15 -> sub_309f -> loc_1e36 chain through
// the live registry from a crafted entry, and prove oracle == optimized across the
// full machine.  This also exercises that the (B, DE) params flow correctly:
// loc_1e36 writes B into 0x6A31.
// ---------------------------------------------------------------------------

/** A booted machine with (0x6343) pointed at benign work RAM (0x6A00) so the real
 *  chain's indirect `ld hl,(0x6343)` + `ld (hl),0` stay inside RAM.  Boot depth 300
 *  leaves a valid return address on the stack so the chain's final `ret` lands in
 *  mapped memory. */
function craftedEntry() {
  const m = new Machine(ROM, {});
  m.runFrames(300);
  const c = m.clone();
  c.mem.write8(0x6343, 0x00);
  c.mem.write8(0x6344, 0x6a); // (0x6343) := 0x6A00
  return c;
}

test("EQUAL (real downstream): optimized loc_1e10 + full chain == oracle (RAM + regs + pc)", () => {
  const a = craftedEntry();
  const b = craftedEntry();
  translated_1e10(a);
  optimized_1e10(b);

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.regs, b.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(a.pc, b.pc, "pc must match");
  assert.equal(a.regs.sp, b.regs.sp, "SP must match");
  assert.equal(b.mem.read8(RECORD_B), BONUS_B, "B=0x7F must have flowed into the 0x6A31 record");
  console.log(`  EQUAL/real: full chain identical; 0x6A31=0x${b.mem.read8(RECORD_B).toString(16)} (B flowed through), 0x6085=${b.mem.read8(0x6085)}`);
});

test("TEETH (value, real downstream): a wrong B is CAUGHT and names 0x6A31", () => {
  // Twin behaviourally identical to optimized EXCEPT B is wrong; the real chain
  // writes it into the 0x6A31 record, so the divergence surfaces there.
  const brokenB = (m) => {
    const { regs } = m;
    regs.b = 0x00; m.step(0x1e12, 7); // WRONG: should be 0x7F
    regs.de = 0x0008; m.step(0x1e15, 10);
    return m.call(CONT);
  };
  const a = craftedEntry();
  const b = craftedEntry();
  translated_1e10(a);
  brokenB(b);

  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  assert.ok(ram != null, "harness FAILED to catch a wrong B store -- it is worthless");
  assert.equal(ram.addr, RECORD_B, `expected the diff at 0x6A31, got 0x${(ram.addr ?? 0).toString(16)}`);
  console.log(`  TEETH/value: caught at 0x${ram.addr.toString(16)} (oracle ${ram.a} vs broken ${ram.b})`);
});
