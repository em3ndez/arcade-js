// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for loc_066a (unpack a packed two-BCD-digit byte and
 * paint it into two VRAM tile cells, suppressing a leading zero). It is a LEAF
 * reached via m.call from the MAIN-LOOP task 10 (entry_062a: its branch-D tail and,
 * via loc_06a8's `jp 0x066a`, its branch-B pass) — genuinely INTERRUPTIBLE (the
 * vblank NMI can fire inside it on a main-loop path). COLLAPSED to one m.step per
 * basic block (see optimized/loc_066a.js); per the lead's collapse-sweep rule the
 * whole-machine gate is the CONVERGENT one UNCONDITIONALLY, and its teeth is a
 * CYCLE-DROP twin (never a value-corruption twin over a long run, which can hang the
 * game -- that coverage stays at the unit level).
 *
 * Six jobs:
 *
 *   1. CONVERGENT (whole-machine) -- optimized loc_066a CONVERGES against its oracle.
 *      The override routes through m.call in the routine registry, inert when the map
 *      is empty. loc_066a first fires on entry_062a's seed pass (~frame 521, branch 1:
 *      0x638C=0x50 -> tens nibble 5) and again on each BCD-decrement pass.
 *
 *   2. EQUAL (unit) -- RAM + all registers (incl. F) + pc identical at the first
 *      natural entry (branch 1).
 *
 *   3. TEETH (convergent + unit) -- convergent: a CYCLE-DROP twin (wrong total) forks
 *      the PRNG, a PERSISTENT divergence, CAUGHT. unit: a deliberately-broken twin
 *      whose one output store to VRAM 0x74E6 (the tens-digit cell, written by the tail
 *      loc_0689 on branch 1) lands a wrong value MUST be caught, naming 0x74E6.
 *
 *   4. BRANCH COVERAGE -- branch 2 (tens nibble == 0, the leading-zero-suppression
 *      arm) is not reached by the 600-frame attract run, so it is SYNTHESISED: clone
 *      the captured entry, set A to a zero-high-nibble value, and diff oracle vs
 *      optimized (RAM + regs + pc). Branch 1 is re-diffed from a clean synthetic A
 *      too, so both data-dependent arms have committed EQUAL teeth.
 *
 *   5. BRANCH-2 TEETH -- a wrong value to one of branch 2's OWN direct stores
 *      (VRAM 0x7486) is caught, so the suppression arm is not left without teeth.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_066a as translated_066a } from "../../translated/mainloop.js";
import { loc_066a as optimized_066a } from "../loc_066a.js";
import { unitEquivalence } from "../harness.js";
import { convergentGate, SCENARIOS } from "./convergent.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { Machine } from "../../machine.js";
import { SND_BGM } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x066a;
const MAX_FRAMES = 600; // the unit harness must run far enough to reach the first entry

// On branch 1 (the natural path) loc_066a makes no stores of its own -- its output
// is the tail loc_0689's write of the tens digit to VRAM 0x74E6. That cell is inside
// the compared state dump (video RAM). It is rewritten only on the NEXT entry_062a
// dispatch (tens of frames later), so a corrupted value persists and the diff stands.
const BROKEN_ADDR = 0x74e6;

// A direct store made by the leading-zero-suppression arm (branch 2), used for that
// arm's synthesised teeth: the blank tile written to VRAM 0x7486.
const BRANCH2_STORE = 0x7486;

/**
 * Deliberately-broken twin: behaviourally the optimized routine EXCEPT the first
 * store to BROKEN_ADDR lands a wrong value (correct byte XOR 0xFF, guaranteed to
 * differ). Intercepting exactly one write lets the rest of the routine and every
 * subroutine it calls (loc_0689) run verbatim -- the representative "wrong value to
 * one of the routine's own output addresses" bug the gate must catch.
 */
function makeBroken(fn, brokenAddr) {
  return (m, ...args) => {
    const realWrite = m.mem.write8.bind(m.mem);
    let broke = false;
    m.mem.write8 = (addr, value, busOffset) => {
      if (!broke && addr === brokenAddr) {
        broke = true;
        return realWrite(addr, value ^ 0xff, busOffset);
      }
      return realWrite(addr, value, busOffset);
    };
    try {
      return fn(m, ...args);
    } finally {
      m.mem.write8 = realWrite;
    }
  };
}
const broken_066a = makeBroken(optimized_066a, BROKEN_ADDR);

/**
 * Capture the machine state at the instant loc_066a is first entered, the same way
 * unitEquivalence does internally (snapshot override installed at construction so it
 * catches the m.call entry, delegating to the oracle so the host run proceeds).
 * Returned clone can be re-cloned and its A set to drive either branch.
 */
function captureEntry(maxFrames = MAX_FRAMES) {
  let entry = null;
  const snapshot = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_066a(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snapshot });
  host.runFrames(maxFrames);
  if (entry === null) {
    throw new Error(`0x${TARGET.toString(16)} never entered within ${maxFrames} frames`);
  }
  return entry;
}

/** Run oracle vs optimized on two clones of `entry` with A forced to `aValue`. */
function diffBranch(entry, aValue, optFn = optimized_066a) {
  const a = entry.clone();
  const b = entry.clone();
  a.regs.a = aValue;
  b.regs.a = aValue;
  translated_066a(a);
  optFn(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  const regs = firstRegDiff(a.regs, b.regs);
  const pc = a.pc === b.pc ? null : { a: a.pc, b: b.pc };
  return { ram, regs, pc, equal: !ram && !regs && !pc };
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine): collapsed loc_066a CONVERGES vs translated", () => {
  const r = convergentGate(new Map([[TARGET, optimized_066a]]), { scenario: SCENARIOS.attract });

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

test("EQUAL (unit): idiomatic optimized loc_066a matches translated in RAM + registers", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_066a, optimized_066a, { maxFrames: MAX_FRAMES });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

// -- TEETH --------------------------------------------------------------------

/**
 * CYCLE-DROP twin for the CONVERGENT gate: identical memory/registers to the collapsed
 * routine, but the nibble-split block charge is 5 t short. A wrong total forks the main
 * loop's spin count (0x6019 PRNG entropy) -- a PERSISTENT divergence, never a heal.
 */
function cyclebroken_066a(m) {
  const { regs, mem } = m;
  regs.c = regs.a;
  regs.and(0x0f);
  regs.b = regs.a;
  regs.a = regs.c;
  regs.rrca(); regs.rrca(); regs.rrca(); regs.rrca();
  regs.and(0x0f);
  m.step(0x0675, 37); // DROPPED: the correct charge here is 42 t
  if (regs.fNZ) {
    m.step(0x0689, 10);
    return m.call(0x0689);
  }
  regs.a = 0x03;
  mem.write8(SND_BGM, regs.a);
  regs.a = 0x70;
  mem.write8(0x7486, regs.a);
  mem.write8(0x74a6, regs.a);
  regs.add(regs.b);
  regs.b = regs.a;
  regs.a = 0x10;
  m.step(0x0689, 78);
  return m.call(0x0689);
}

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_066a]]), { scenario: SCENARIOS.attract });

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

test("TEETH (unit): a wrong tens-digit store is CAUGHT and names 0x74E6", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_066a, broken_066a, { maxFrames: MAX_FRAMES });

  assert.equal(r.equal, false, "harness FAILED to catch a wrong store — it is worthless");
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

// -- BRANCH COVERAGE ----------------------------------------------------------

test("BRANCH COVERAGE: both nibble arms EQUAL (branch 1 non-zero tens; branch 2 zero tens / synthesised)", () => {
  const entry = captureEntry();

  // Branch 1: tens nibble non-zero (0x53 -> tens 5, ones 3). Also the natural path,
  // re-diffed here from a clean synthetic A so the arm has explicit committed teeth.
  const b1 = diffBranch(entry, 0x53);
  assert.equal(b1.ram, null, b1.ram ? `branch1 RAM diff at 0x${b1.ram.addr.toString(16)}` : "");
  assert.equal(b1.regs, null, b1.regs ? `branch1 reg diff at ${b1.regs.reg}` : "");
  assert.equal(b1.pc, null, "branch1 pc must match");

  // Branch 2: tens nibble zero (0x07 -> leading-zero suppression). Not reached by the
  // attract run, so synthesised.
  const b2 = diffBranch(entry, 0x07);
  assert.equal(b2.ram, null, b2.ram ? `branch2 RAM diff at 0x${b2.ram.addr.toString(16)}` : "");
  assert.equal(b2.regs, null, b2.regs ? `branch2 reg diff at ${b2.regs.reg}` : "");
  assert.equal(b2.pc, null, "branch2 pc must match");

  // Also exercise A=0x00 (both nibbles zero -> branch 2, ones digit 0).
  const b2zero = diffBranch(entry, 0x00);
  assert.equal(b2zero.equal, true, "branch2 A=0x00 must be EQUAL");

  console.log("  BRANCH COVERAGE: branch 1 (A=0x53) + branch 2 (A=0x07, A=0x00) all EQUAL");
});

test("BRANCH-2 TEETH: a wrong direct store on the suppression arm is CAUGHT and names 0x7486", () => {
  const entry = captureEntry();
  const brokenBranch2 = makeBroken(optimized_066a, BRANCH2_STORE);

  const r = diffBranch(entry, 0x07, brokenBranch2);
  assert.equal(r.equal, false, "harness FAILED to catch a wrong branch-2 store — it is worthless");
  assert.ok(r.ram != null, "a caught divergence must name a RAM address");
  assert.equal(
    r.ram.addr,
    BRANCH2_STORE,
    `expected first diff at 0x${BRANCH2_STORE.toString(16)}, got 0x${r.ram.addr.toString(16)}`,
  );
  console.log(
    `  BRANCH-2 TEETH: caught at 0x${r.ram.addr.toString(16)} ` +
      `(translated ${r.ram.a} vs broken ${r.ram.b})`,
  );
});
