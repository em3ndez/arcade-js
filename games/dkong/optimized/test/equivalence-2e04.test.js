// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for entry_2e04 -- the per-object actor/animation updater at ROM
 * 0x2E04: `ld a,0x04`, two skip-capable rst gates (rst 0x30 BOARD gate, rst 0x10 ENABLE
 * gate), then a 10-iteration djnz loop that dispatches obj_2e12 per object over the
 * 0x6500 table (stride 0x10), mirroring into the 0x6980 sprite records (stride 0x04).
 * See optimized/entry_2e04.js for the full behaviour block.
 *
 * COLLAPSE: only ONE fold -- the three setup `ld` (ld ix + ld iy + ld b) into a single
 * 35 t m.step at 0x2E12, on the FULL-LOOP path. The `ld a`, both rst gates, the loop's
 * per-iteration djnz charge, and the `ret` are kept verbatim.
 *
 * REACHABILITY / GATE (measured, not assumed). loc_197a's NMI cascade dispatches
 * entry_2e04 816x over 1400 attract frames (first ~f586). ATOMIC: io.nmiMask == 0 at
 * 816/816 dispatches, and no NMI pushed-PC lands in [0x2E04,0x2E83] over 1394 NMIs -- so
 * the STRICT byte-exact whole-machine gate is the license. BUT the natural attract arm
 * is ALWAYS gate1-skip (board 0x6227 == 1 at 816/816, and rst 0x30 with A=0x04 passes
 * only for board == 3), so the loop + its fold are never exercised in attract. The
 * STRICT gate therefore proves the gate1-skip arm byte-exact (non-vacuous, 816x), and
 * the two board-3-gated arms (gate2-skip, full-loop) are proven -- like sub_2a22's
 * board-gated collapse -- from crafted identical-both-sides pokes (the decompiler-pipeline doc pattern 3:
 * poke 0x6227 = 3 and 0x6200 bit0) that steer the game's OWN gates, with each arm's
 * EXACT oracle cycle total pinned directly and a dropped-fold twin as the teeth.
 *
 * Jobs: STRICT whole-machine EQUAL (+ invocation proof) and its cycle-total teeth; UNIT
 * EQUAL on the natural first entry and its behavioural (ignore-gate1-skip) teeth;
 * FULL-BRANCH coverage of all three arms from crafted pokes (EQUAL over RAM+regs+pc+SP
 * AND each arm's exact cycle TOTAL); and a dropped-fold-charge cycle twin CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { entry_2e04 as translated_2e04 } from "../../translated/state0.js";
import { entry_2e04 as optimized_2e04 } from "../entry_2e04.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2e04;
const FRAMES_WHOLE = 1400; // past the ~f586 first dispatch; ~816 invocations (all gate1-skip)
const FRAMES_UNIT = 650; // the unit host must run past the first dispatch (~f586) to capture it

const RET_ADDR = 0x4d17; // sentinel caller-return address for crafted entries

// A verbatim copy of the optimized control flow, so the teeth twins below differ from
// it by EXACTLY one deliberate bug and nothing else.
function makeRoutine({ gate30 = 11, gate10 = 11, fold = 35, ignoreGate1 = false } = {}) {
  return (m) => {
    const { regs } = m;
    regs.a = 0x04;
    m.step(0x2e06, 7);
    m.push16(0x2e07);
    m.step(0x0030, gate30);
    const g1 = m.call(0x0030);
    if (!ignoreGate1 && !g1) return; // BUG when ignoreGate1: keep going after a splice
    m.push16(0x2e08);
    m.step(0x0010, gate10);
    if (!m.call(0x0010)) return;
    regs.ix = 0x6500;
    regs.iy = 0x6980;
    regs.b = 0x0a;
    m.step(0x2e12, fold);
    do {
      m.call(0x2e12);
      regs.djnz();
      m.step(regs.b !== 0 ? 0x2e12 : 0x2e83, regs.b !== 0 ? 13 : 8);
    } while (regs.b !== 0);
    m.ret();
  };
}

// -- WHOLE-MACHINE (strict, byte-exact -- ATOMIC; covers the natural gate1-skip arm) --

test("STRICT (whole-machine): entry_2e04 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_2e04]]));
  const fired = r.invocations.get(TARGET);
  assert.ok(fired >= 1, `override at 0x${TARGET.toString(16)} never dispatched (invocations=${fired})`);
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `NOT byte-exact: frame ${r.frame} addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
  console.log(`  STRICT: byte-exact over ${r.framesCompared} frames, fired ${fired}x (atomic, gate1-skip arm)`);
});

test("STRICT-TEETH (cycles): a wrong rst-gate charge forks the trajectory and is CAUGHT", () => {
  // The load-bearing invariant is total-cycle preservation. Charging rst 0x30 10 t
  // instead of 11 shifts every gate1-skip frame's budget -> the spin count 0x6019 (PRNG
  // entropy) and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = makeRoutine({ gate30: 10 });
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry -- the gate1-skip arm) --------------------------

/** Capture the pristine machine the instant entry_2e04 is first entered (via m.call,
 *  deep in the NMI cascade). The snapshot override is wired at CONSTRUCTION so it fires
 *  however the routine is reached, then delegates to the oracle so the host proceeds. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_2e04(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}
const NATURAL_ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Run oracle and `fn` on independent clones of `entry`; report the diff. */
function runBoth(entry, fn) {
  const a = entry.clone();
  const b = entry.clone();
  translated_2e04(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic entry_2e04 matches translated in RAM + full register file + pc", () => {
  const r = runBoth(NATURAL_ENTRY, optimized_2e04);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F, SP) + pc identical (natural gate1-skip entry)");
});

test("TEETH (unit behavioural): ignoring rst 0x30's skip boolean is CAUGHT", () => {
  // The natural first entry takes the GATE-1 SKIP arm (measured: board == 1, so rst 0x30
  // splices). A twin that ignores that boolean keeps running -- pushing the rst 0x10 gate
  // onto the already-unwound stack -- so its RAM/pc/SP diverge from the oracle's early return.
  const broken_ignoreSkip = makeRoutine({ ignoreGate1: true });
  const r = runBoth(NATURAL_ENTRY, broken_ignoreSkip);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch an ignored skip boolean -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${!r.pcEqual ? "pc" : !r.spEqual ? "SP" : r.regs ? r.regs.reg : "ram"} diverged`);
});

// -- FULL-BRANCH COVERAGE (crafted identical-both-sides pokes: all 3 arms) ------

/**
 * Fresh machine with a valid stack (a sentinel caller-return frame) and RAM poked so
 * the game's OWN gates drive entry_2e04 down the chosen arm -- the sanctioned
 * identical-both-sides poke (the decompiler-pipeline doc pattern 3), applied to both oracle and optimized
 * clones through the same seed:
 *   - board != 3              -> rst 0x30 (needs board 3) splices          -> gate1-skip
 *   - board == 3, 0x6200 bit0=0 -> rst 0x30 normal; rst 0x10 splices       -> gate2-skip
 *   - board == 3, 0x6200 bit0=1 -> both gates normal -> 10-object loop + ret -> full-loop
 */
function seed(pokes) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // entry_2e04's own caller-return frame
  const entrySP = m.regs.sp;
  for (const [a, v] of pokes) m.mem.write8(a, v);
  return { m, entrySP };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle
 *  total: optimized must equal the oracle, and (as a regression guard) the oracle total
 *  must equal the measured structural constant `expectCycles`. */
function assertArm(label, pokes, expectCycles) {
  const a = seed(pokes);
  const b = seed(pokes);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_2e04(a.m);
  optimized_2e04(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;

  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg}` : "");
  assert.equal(a.m.pc, b.m.pc, `${label}: pc must match`);
  assert.equal(a.m.regs.sp, b.m.regs.sp, `${label}: SP must match`);
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs optimized ${dB} t)`);
  assert.equal(dA, expectCycles, `${label}: oracle total should be ${expectCycles} t (got ${dA})`);
  // Every arm unwinds to the caller sentinel with the stack balanced.
  assert.equal(b.m.pc, RET_ADDR, `${label}: must return/unwind to the caller sentinel`);
  assert.equal(b.m.regs.sp, a.entrySP + 2, `${label}: stack must be balanced (caller frame consumed)`);
  console.log(`  BRANCH/${label}: EQUAL -- pc=0x${b.m.pc.toString(16)}, sp=0x${b.m.regs.sp.toString(16)}, ` +
    `${dB} t == oracle ${dA} t`);
}

test("BRANCH (unit): gate1-skip -- board != 3, rst 0x30 splices past entry_2e04", () => {
  assertArm("gate1-skip", [[0x6227, 1], [0x6200, 1]], 84);
});

test("BRANCH (unit): gate2-skip -- board == 3 (gate1 normal), rst 0x10 splices (0x6200 bit0=0)", () => {
  assertArm("gate2-skip", [[0x6227, 3], [0x6200, 0]], 159);
});

test("BRANCH (unit): full-loop -- board == 3 & 0x6200 bit0=1, 10 obj_2e12 passes + ret", () => {
  assertArm("full-loop", [[0x6227, 3], [0x6200, 1]], 1383);
});

test("BRANCH-TEETH (cycles): a dropped fold charge (35->30) yields a wrong total and is CAUGHT", () => {
  // The fold is the routine's only collapse and lives on the full-loop arm, so its teeth
  // live here. Charge the collapsed prologue 30 t instead of 35 -> total no longer matches
  // the oracle. Uses the crafted full-loop seed so the arm is deterministic.
  const dropped = makeRoutine({ fold: 30 });
  const a = seed([[0x6227, 3], [0x6200, 1]]);
  const b = seed([[0x6227, 3], [0x6200, 1]]);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_2e04(a.m);
  dropped(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH: oracle ${dA} t vs dropped-fold ${dB} t -- caught`);
});
