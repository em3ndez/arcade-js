// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_2e9c -- the animation-string TERMINATOR handler of the
 * per-object updater (entry_2e04 / obj_2e12): rewind the walk pointer to 0x39AA,
 * request the object's sound (0x6083 := 3), and TAIL-JUMP into loc_2e4b.
 *
 * KEPT PER-INSTRUCTION (not collapsed) -- see optimized/loc_2e9c.js for the why:
 * the routine runs only inside loc_197a's interruptible cascade and has 0
 * whole-machine dispatches (attract + driven 25m), so there is no convergent run
 * to license a collapse. Verified instead from a CRAFTED ENTRY: a booted machine
 * captured at entry_2e04's dispatch (reached in attract), cloned, then seeded with
 * the object/sprite record pointers (IX=0x6500, IY=0x6980) and C=0x7F (the
 * terminator byte obj_2e12 leaves in C for loc_2e4b) exactly as at the real call
 * site. loc_2e9c tail-jumps into loc_2e4b, which runs as the FROZEN ORACLE via the
 * registry on both sides, so any diff is loc_2e9c's own doing.
 *
 * No whole-machine/convergent run exists for this routine (crafted-entry only), so
 * the PRNG spin-count gate does not cover a wrong cycle total here -- the dedicated
 * CYCLES test below pins the routine's cycle total against the oracle explicitly
 * (with a cycle-drop twin as teeth), on two seeds that take different loc_2e4b
 * tail branches.
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { entry_2e04 as translated_2e04 } from "../../translated/state0.js";
import { loc_2e9c as translated_2e9c } from "../../translated/state0.js";
import { loc_2e9c as optimized_2e9c } from "../loc_2e9c.js";
import { Machine } from "../../machine.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const FRAMES = 900;
const makeMachine = (overrides) => new Machine(ROM, overrides ? { overrides } : {});

// Capture a real, booted machine at the moment entry_2e04 is dispatched (it runs
// inside loc_197a during the attract demo, so a bare boot reaches it). The clone
// gives loc_2e9c a valid RAM image, register file and routine registry to run
// against; we overwrite only the object pointers + C below.
function captureEntry() {
  let entry = null;
  const snap = new Map([[0x2e04, (mm) => { if (entry === null) entry = mm.clone(); return translated_2e04(mm); }]]);
  const host = makeMachine(snap);
  host.runFrames(FRAMES);
  if (entry === null) throw new Error("entry_2e04 never dispatched — cannot craft a loc_2e9c entry");
  return entry;
}
const ENTRY = ROM_PRESENT ? captureEntry() : null;

// Seed the crafted call site. `ix03` steers loc_2e4b's tail branch (< 0xB7 ->
// mirror+advance; >= 0xB7 with C=0x7F -> set state 4 + sound), so the two seeds
// exercise both tail chains behind loc_2e9c.
function seed(mm, ix03) {
  mm.regs.ix = 0x6500; // object record base entry_2e04 uses
  mm.regs.iy = 0x6980; // its sprite record base
  mm.regs.c = 0x7f;    // the terminator byte obj_2e12 leaves in C for loc_2e4b
  mm.mem.write8((0x6500 + 0x03) & 0xffff, ix03); // (ix+0x03): position vs the 0xB7 boundary
  mm.mem.write8((0x6500 + 0x05) & 0xffff, 0x40); // (ix+0x05): a plausible Y accumulator
  return mm;
}

function runBoth(optFn, ix03) {
  const a = seed(ENTRY.clone(), ix03);
  const b = seed(ENTRY.clone(), ix03);
  translated_2e9c(a);
  optFn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pc: [a.pc, b.pc],
  };
}

// A behavioural twin: corrupt loc_2e9c's sound-latch write. Uses the < 0xB7 seed,
// where loc_2e4b does NOT re-write 0x6083, so the corruption survives to be caught
// (in the >= 0xB7 branch loc_2e4b's `xor a; ld (0x6083),a` would mask it -- the
// doc-06 re-poked-output wrinkle, which is why the teeth seed is < 0xB7).
function brokenWrite(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (a, value, busOffset) => {
    if (!broke && a === 0x6083) { broke = true; return realWrite(a, value ^ 0xff, busOffset); }
    return realWrite(a, value, busOffset);
  };
  try { return optimized_2e9c(m); } finally { m.mem.write8 = realWrite; }
}

test("EQUAL (crafted entry): loc_2e9c matches the oracle in state + registers", () => {
  for (const ix03 of [0x40, 0xc0]) { // < 0xB7 (mirror/advance) and >= 0xB7 (state-4/sound) tail branches
    const { ram, regs, pc } = runBoth(optimized_2e9c, ix03);
    assert.equal(ram, null, ram ? `RAM diff at 0x${ram.addr.toString(16)} (ix+3=0x${ix03.toString(16)})` : "");
    assert.equal(regs, null, regs ? `reg diff at ${regs.reg} (ix+3=0x${ix03.toString(16)})` : "");
    assert.equal(pc[0], pc[1], `pc must match (ix+3=0x${ix03.toString(16)})`);
    console.log(`  EQUAL (ix+3=0x${ix03.toString(16)}): terminator rewind + sound EQUAL (state + regs + pc)`);
  }
});

// -- MANDATORY CYCLE-TOTAL. Crafted-entry only, no whole-machine/convergent run, so
// the PRNG gate does not cover the cycle total -- pin it explicitly. Both sides run
// the SAME oracle loc_2e4b tail from identical state, so a correct loc_2e9c yields an
// identical total delta; the cycle-drop twin below proves the pin has teeth. ------

// Cycle-drop twin: same effects, but the tail `jp` step is charged 9 t instead of
// the oracle's 10 t (a dropped T-state the pin must catch).
function cycleDropTwin(m) {
  const { regs, mem } = m;
  regs.hl = 0x39aa;
  m.step(0x2e9f, 10);
  regs.a = 0x03;
  m.step(0x2ea1, 7);
  mem.write8(0x6083, regs.a);
  m.step(0x2ea4, 13);
  m.step(0x2e4b, 9); // BUG: one T-state short of the oracle's 10
  return m.call(0x2e4b);
}

test("CYCLES: loc_2e9c charges the exact oracle total (per-instruction, teeth verified)", () => {
  for (const ix03 of [0x40, 0xc0]) {
    const a = seed(ENTRY.clone(), ix03);
    const b = seed(ENTRY.clone(), ix03);
    const ca0 = a.cycles, cb0 = b.cycles;
    translated_2e9c(a);
    optimized_2e9c(b);
    const dA = a.cycles - ca0, dB = b.cycles - cb0;
    assert.equal(dB, dA, `ix+3=0x${ix03.toString(16)}: cycle total mismatch (oracle ${dA} t vs optimized ${dB} t)`);
    console.log(`  CYCLES (ix+3=0x${ix03.toString(16)}): oracle ${dA} t == optimized ${dB} t`);

    // teeth: the cycle-drop twin must NOT match the oracle total.
    const c = seed(ENTRY.clone(), ix03);
    const cc0 = c.cycles;
    cycleDropTwin(c);
    const dC = c.cycles - cc0;
    assert.notEqual(dC, dA, `ix+3=0x${ix03.toString(16)}: cycle-drop twin (${dC} t) slipped past the pin (${dA} t)`);
  }
  console.log("  CYCLES: cycle-drop twin CAUGHT on both seeds");
});

test("TEETH (crafted entry): a corrupted sound-latch write is CAUGHT and NOT-EQUAL", () => {
  const { ram } = runBoth(brokenWrite, 0x40); // < 0xB7 seed: 0x6083 not re-written by loc_2e4b
  assert.ok(ram != null, "harness FAILED to catch a wrong 0x6083 store");
  assert.equal(ram.addr, 0x6083, `expected the catch at 0x6083, got 0x${ram.addr.toString(16)}`);
  console.log(`  TEETH: caught at 0x${ram.addr.toString(16)} (oracle ${ram.a} vs broken ${ram.b})`);
});
