// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for loc_1b45 (the on-ladder "climb up" input test, ROM
 * 0x1B45-0x1B4D). KEPT PER-INSTRUCTION (see optimized/loc_1b45.js for why): it lives
 * inside the entry_1ac3 movement cascade reached only from loc_197a, the interruptible
 * in-game update cascade the vblank NMI lands inside, and docs/06 forbids collapsing a
 * 0x1xxx cascade routine on short-run evidence. Because the charges stay one-per-
 * instruction, the per-frame cycle distribution is byte-identical to the oracle by
 * construction, so no whole-machine / convergent gate is needed to license a collapse
 * (there is none). Equivalence is proven the sub_13ca way: a CRAFTED ENTRY.
 *
 * REACHABILITY. loc_1b45 does not dispatch in any run this harness can drive: it fires
 * only in real gameplay with Mario on a ladder (loc_1b38 reaches it only when
 * MARIO_ON_LADDER 0x6215 != 0 and Down is not held), and neither attract nor a driven
 * coin+start input tape advances the JS machine into gameplay (measured: game state
 * 0x6005 stays 0, no credit accrues). So — exactly like sub_13ca — we capture a real
 * booted machine at a REACHABLE dispatch (loc_0fd7, which runs in attract and leaves a
 * LIVE stack with a poppable return address), clone it, poke the one deciding byte
 * P1_INPUT (0x6010) identically on both sides, and run oracle vs optimized directly.
 * The poke is applied to BOTH clones through the same factory, so it steers the real
 * routine rather than faking its effect (docs/06 reach pattern 3).
 *
 * Jobs:
 *   1. EQUAL (crafted entry) -- optimized loc_1b45 matches the oracle in RAM + full
 *      register file + pc on a representative entry.
 *   2. FULL-BRANCH COVERAGE -- both arms, synthesised by poking 0x6010 on both sides:
 *        - Up not held  (bit 2 clear): ret, 41 t (13+8+10+10), ABSOLUTE + state-indep.
 *        - Left only    (bit 2 clear, bit 1 set): still ret -- proves bit 2 is the
 *          sole decider, other direction bits don't trigger the climb.
 *        - Up held      (bit 2 set): tail-jump to entry_1d03 (climb stepper); EQUAL
 *          including entry_1d03's effects, oracle == optimized cycle total.
 *        - Up + all bits (0xff): still climbs -- only bit 2 matters for the branch.
 *   3. CYCLES (climb prologue) -- with 0x1d03 stubbed to a no-op on both sides, the
 *      loc_1b45 prologue charges EXACTLY 31 t (13+8+10) -- pins the jp-taken charge
 *      the ret arm doesn't reach, absolutely and state-independently.
 *   4. CYCLE-TEETH -- a twin that drops the `ret` 10 t yields a wrong total, CAUGHT.
 *   5. TEETH (branch) -- a twin testing bit 3 instead of bit 2 takes the WRONG arm on
 *      an Up-held input (rets instead of climbing), CAUGHT as a RAM/pc divergence.
 *   6. TEETH (register file) -- a twin that corrupts the exit A on the ret path is
 *      CAUGHT as a register diff (the unit gate compares the whole file incl. F).
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0fd7 as translated_0fd7 } from "../../translated/state0.js";
import { loc_1b45 as translated_1b45 } from "../../translated/state0.js";
import { loc_1b45 as optimized_1b45 } from "../loc_1b45.js";
import { Machine } from "../../machine.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { P1_INPUT } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x1b45;
const FRAMES = 600; // loc_0fd7 is entered well within an attract run

/** Capture the pristine machine at loc_0fd7's dispatch -- a REACHABLE routine with a
 *  LIVE stack (a poppable return address), so loc_1b45's `ret` / entry_1d03's `ret`
 *  land on a valid address. A constructor override snapshots the entry, then delegates
 *  to the oracle so the host run proceeds normally to a clean stop. (sub_13ca does the
 *  same.) */
function captureEntry() {
  let entry = null;
  const snap = new Map([[0x0fd7, (mm) => { if (entry === null) entry = mm.clone(); return translated_0fd7(mm); }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(FRAMES);
  if (entry === null) throw new Error("loc_0fd7 never entered -- cannot craft a loc_1b45 entry");
  return entry;
}
const ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Clone ENTRY, poke P1_INPUT to `input` (the deciding byte), optionally stub 0x1d03,
 *  run `fn`, and report the routine's full contract relative to the crafted entry. */
function runBranch(input, fn, { stub1d03 = null } = {}) {
  const c = ENTRY.clone();
  c.mem.write8(P1_INPUT, input);
  if (stub1d03) c.routines.set(0x1d03, stub1d03);
  const c0 = c.cycles;
  const ret = fn(c);
  return { ret, cycles: c.cycles - c0, sp: c.regs.sp, pc: c.pc, machine: c };
}

/** Prove one synthesised branch EQUAL across the whole contract: RAM, the full
 *  register file, pc, and SP. `expectCycles` (when given) pins the branch's cycle
 *  total absolutely; otherwise the oracle's own total is the reference (state-dependent
 *  arms like the climb tail, whose total includes entry_1d03). */
function assertBranchEqual(label, input, expectCycles = null, opts = {}) {
  const o = runBranch(input, translated_1b45, opts);
  const p = runBranch(input, optimized_1b45, opts);

  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(o.machine.regs, p.machine.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(o.pc, p.pc, "pc must match between oracle and optimized");
  assert.equal(o.sp, p.sp, "SP must match the oracle");
  assert.equal(o.cycles, p.cycles, "cycle total must match the oracle");
  if (expectCycles !== null) {
    assert.equal(o.cycles, expectCycles, `oracle cycle total should be ${expectCycles} t on this arm`);
  }
  console.log(
    `  BRANCH/${label}: EQUAL -- 0x6010=0x${input.toString(16)}, ${p.cycles} t, ` +
      `pc=0x${p.pc.toString(16)}, A=0x${p.machine.regs.a.toString(16)}, F=0x${p.machine.regs.f.toString(16)}`,
  );
}

// -- EQUAL + FULL-BRANCH COVERAGE --------------------------------------------

test("EQUAL (crafted entry): optimized loc_1b45 matches translated in RAM + registers + pc", () => {
  // Representative entry: Up not held -> the plain ret path.
  const o = runBranch(0x00, translated_1b45);
  const p = runBranch(0x00, optimized_1b45);
  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${ram.addr.toString(16)}` : "");
  assert.equal(firstRegDiff(o.machine.regs, p.machine.regs), null, "registers must match");
  assert.equal(o.pc, p.pc, "pc must match");
  console.log("  EQUAL: RAM + full register file (incl. A, F, SP) + pc identical");
});

test("BRANCH: Up not held (bit 2 clear) -- ret, 41 t", () => {
  assertBranchEqual("up-not-held", 0x00, 41);
});

test("BRANCH: Left only (bit 1 set, bit 2 clear) -- still ret (bit 2 is the sole decider)", () => {
  assertBranchEqual("left-only", 0x02, 41);
});

test("BRANCH: Up held (bit 2 set) -- tail-jump to entry_1d03 climb stepper", () => {
  // State-dependent total (includes entry_1d03's run from the captured state); the
  // oracle's own total is the reference. The 31 t loc_1b45 prologue is pinned
  // absolutely by the CYCLES test below.
  assertBranchEqual("up-held", 0x04);
});

test("BRANCH: Up + all other bits set (0xff) -- still climbs (only bit 2 gates the branch)", () => {
  assertBranchEqual("up-plus-all", 0xff);
});

// -- CYCLES (climb prologue, absolute) ---------------------------------------

test("CYCLES: the climb arm's loc_1b45 prologue charges exactly 31 t (13+8+10)", () => {
  // Stub 0x1d03 to a no-op so we measure ONLY loc_1b45's own prologue (ld+bit+jp-taken),
  // isolating the jp-taken charge the ret arm never reaches. Applied to both sides.
  const noop = () => {};
  const o = runBranch(0x04, translated_1b45, { stub1d03: noop });
  const p = runBranch(0x04, optimized_1b45, { stub1d03: noop });
  assert.equal(o.cycles, 31, "oracle climb prologue must be 31 t");
  assert.equal(p.cycles, 31, "optimized climb prologue must be 31 t");
  assert.equal(o.pc, 0x1d03, "prologue must end at the jp target 0x1d03");
  console.log(`  CYCLES: climb prologue oracle ${o.cycles} t == optimized ${p.cycles} t (== 31)`);
});

// -- TEETH -------------------------------------------------------------------

test("CYCLE-TEETH: dropping the ret's 10 t yields a wrong total and is CAUGHT", () => {
  const good = runBranch(0x00, optimized_1b45);
  const dropped = runBranch(0x00, (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(P1_INPUT); m.step(0x1b48, 13);
    regs.bit(2, regs.a); m.step(0x1b4a, 8);
    if (regs.fNZ) { m.step(0x1d03, 10); return m.call(0x1d03); }
    m.step(0x1b4d, 10);
    m.ret(0); // DROPPED: the correct ret charge is 10 t
  });
  assert.equal(good.cycles, 41, "the correct Up-not-held total is 41 t");
  assert.notEqual(dropped.cycles, good.cycles, "cycle-total assertion has no teeth");
  console.log(`  CYCLE-TEETH: correct 41 t vs dropped-ret ${dropped.cycles} t -- caught`);
});

test("TEETH (branch): a twin testing bit 3 instead of bit 2 takes the WRONG arm and is CAUGHT", () => {
  // Input 0x04: bit 2 = Up set, bit 3 = Down clear. The oracle CLIMBS (entry_1d03
  // runs, writing RAM); the bit-3 twin RETs (writes nothing) -- a RAM/pc divergence.
  const wrongBit = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(P1_INPUT); m.step(0x1b48, 13);
    regs.bit(3, regs.a); m.step(0x1b4a, 8); // BUG: bit 3 (Down), not bit 2 (Up)
    if (regs.fNZ) { m.step(0x1d03, 10); return m.call(0x1d03); }
    m.step(0x1b4d, 10);
    m.ret(10);
  };
  const o = runBranch(0x04, translated_1b45);
  const b = runBranch(0x04, wrongBit);
  const ram = firstStateDiff(o.machine.dumpState(), b.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.ok(ram != null || o.pc !== b.pc, "harness FAILED to catch a wrong branch decision");
  console.log(
    `  TEETH/branch: caught -- ${ram ? `RAM diff at 0x${ram.addr.toString(16)}` : ""}` +
      `${ram && o.pc !== b.pc ? ", " : ""}${o.pc !== b.pc ? `pc 0x${o.pc.toString(16)} vs 0x${b.pc.toString(16)}` : ""}`,
  );
});

test("TEETH (register file): a twin that corrupts the exit A on the ret path is CAUGHT", () => {
  // Same control flow, but the ret-path exit A is wrong. A is observable (the unit gate
  // compares the whole register file), so a reg diff must name it.
  const corruptExitA = (m) => {
    const { regs, mem } = m;
    regs.a = mem.read8(P1_INPUT); m.step(0x1b48, 13);
    regs.bit(2, regs.a); m.step(0x1b4a, 8);
    if (regs.fNZ) { m.step(0x1d03, 10); return m.call(0x1d03); }
    m.step(0x1b4d, 10);
    regs.a ^= 0xff; // BUG: corrupt the exit A
    m.ret(10);
  };
  const o = runBranch(0x00, translated_1b45);
  const b = runBranch(0x00, corruptExitA);
  const regs = firstRegDiff(o.machine.regs, b.machine.regs);
  assert.ok(regs != null, "harness FAILED to catch a corrupted exit register");
  assert.equal(regs.reg, "a", `expected the diff at A, got ${regs.reg}`);
  console.log(`  TEETH/regfile: caught at ${regs.reg} (oracle 0x${o.machine.regs.a.toString(16)} vs broken 0x${b.machine.regs.a.toString(16)})`);
});
