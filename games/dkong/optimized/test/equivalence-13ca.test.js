// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_13ca (format a score to display digits and insertion-sort it
 * into the high-score table). COLLAPSED (one m.step per basic block; see optimized/sub_13ca.js
 * for the fold). Verified from a crafted entry: a booted machine captured at loc_0fd7's
 * dispatch, cloned, with HL pointed at a 3-byte score, A set to an entry index, and 0x6007
 * bit0 cleared so the rst 0x08 guard does not abort.
 *
 * No whole-machine/convergent run exists for this routine (crafted-entry only), so the PRNG
 * gate does not cover a wrong cycle total here -- the dedicated CYCLES test below pins the
 * collapsed routine's cycle total against the oracle explicitly, on two seeds that take
 * different insertion-sort paths (so the loop folds are exercised, not just the straight-line
 * prologue/epilogue).
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0fd7 as translated_0fd7 } from "../../translated/state0.js";
import { sub_13ca as translated_13ca } from "../../translated/state0.js";
import { sub_13ca as optimized_13ca } from "../sub_13ca.js";
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
  if (entry === null) throw new Error("loc_0fd7 never entered — cannot craft a sub_13ca entry");
  return entry;
}
const ENTRY = ROM_PRESENT ? captureEntry() : null;

// Seed a machine so sub_13ca takes the full path with a concrete score to insert.
function seed(mm) {
  mm.mem.write8(0x6007, mm.mem.read8(0x6007) & 0xfe); // clear bit0 -> rst 0x08 does not abort
  // a 3-byte packed BCD score at 0x3f00 (unused-ish ROM addr is read-only; use work RAM):
  mm.mem.write8(0x6100, 0x50); mm.mem.write8(0x6101, 0x00); mm.mem.write8(0x6102, 0x01);
  mm.regs.hl = 0x6100; // source score
  mm.regs.a = 0x00;    // entry index
  return mm;
}

function brokenAt(addr) {
  return (m) => {
    const realWrite = m.mem.write8.bind(m.mem);
    let broke = false;
    m.mem.write8 = (a, value, busOffset) => {
      if (!broke && a === addr) { broke = true; return realWrite(a, value ^ 0xff, busOffset); }
      return realWrite(a, value, busOffset);
    };
    try { return optimized_13ca(m); } finally { m.mem.write8 = realWrite; }
  };
}

function runBoth(optFn = optimized_13ca) {
  const a = seed(ENTRY.clone());
  const b = seed(ENTRY.clone());
  translated_13ca(a);
  optFn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pc: [a.pc, b.pc],
  };
}

test("EQUAL (crafted entry): sub_13ca matches translated in state + registers", () => {
  const { ram, regs, pc } = runBoth();
  assert.equal(ram, null, ram ? `RAM diff at 0x${ram.addr.toString(16)}` : "");
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(pc[0], pc[1], "pc must match");
  console.log("  EQUAL: score format + insert EQUAL (state + regs + pc)");
});

// -- MANDATORY CYCLE-TOTAL (sub_13ca's test is crafted-entry only, no whole-machine/
// convergent run, so the PRNG gate does not cover a wrong cycle total on the
// COLLAPSED routine -- pin it explicitly, on seeds that exercise different
// insertion-sort trip counts so the loop folds are actually stressed.) -----------

test("CYCLES: collapsed sub_13ca charges the exact oracle total (loop folds correct)", () => {
  const cases = [
    { name: "seed 0x50/0x00/0x01 (default)", score: [0x50, 0x00, 0x01] },
    { name: "seed 0x00/0x00/0x00 (low score)", score: [0x00, 0x00, 0x00] },
    { name: "seed 0x99/0x99/0x09 (max BCD score)", score: [0x99, 0x99, 0x09] },
  ];
  for (const c of cases) {
    const a = seed(ENTRY.clone());
    const b = seed(ENTRY.clone());
    for (const [i, byte] of c.score.entries()) {
      a.mem.write8(0x6100 + i, byte);
      b.mem.write8(0x6100 + i, byte);
    }
    const ca0 = a.cycles, cb0 = b.cycles;
    translated_13ca(a);
    optimized_13ca(b);
    const dA = a.cycles - ca0, dB = b.cycles - cb0;
    assert.equal(dB, dA, `${c.name}: cycle total mismatch (oracle ${dA} t vs collapsed ${dB} t)`);
    console.log(`  CYCLES/${c.name}: oracle ${dA} t == collapsed ${dB} t`);
  }
});

test("TEETH (crafted entry): a wrong digit unpack is CAUGHT and NOT-EQUAL", () => {
  // Break the first unpacked BCD digit (0x61B1). The insertion-sort swap can relocate the
  // corrupted byte, so the first-diff address is data-dependent -- assert only that the wrong
  // value is caught somewhere.
  const { ram } = runBoth(brokenAt(0x61b1));
  assert.ok(ram != null, "harness FAILED to catch a wrong store");
  console.log(`  TEETH: caught at 0x${ram.addr.toString(16)} (translated ${ram.a} vs broken ${ram.b})`);
});
