// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for sub_0030 -- the `rst 0x30` vector helper, a
 * bit-select skip gate (rotate A right (BOARD) times, then either return normally
 * or `pop hl` to skip the caller's next op). It is a LEAF reached only via
 * `m.call(0x0030)` from 20 sites, most of them mask-enabled main-loop /
 * interruptible gameplay routines -- NOT atomic. Its m.step charges are COLLAPSED
 * to one per basic block, with the rrca+djnz loop folded per ITERATION rather than
 * across iterations (see optimized/sub_0030.js) -- licensed by the CONVERGENT gate
 * rather than the strict whole-machine gate, since a passing strict result would
 * only prove the tested scenario happened not to interrupt it.
 *
 * Five jobs:
 *
 *   1. CONVERGENT (whole-machine) -- pixels + non-stack state converge under
 *      SCENARIOS.attract. It fires purely in ATTRACT (no input needed): first at
 *      frame 5, then almost every frame. The override routes through the routine
 *      registry (installed at construction so a leaf reached only via m.call is
 *      caught).
 *
 *   2. EQUAL (unit) -- identical RAM + full register file (incl. F) + pc at the
 *      first natural entry.
 *
 *   3. TEETH (convergent) -- a CYCLE-DROP twin (the prologue block's charge 5 t
 *      short) forks the PRNG spin count: a PERSISTENT divergence, CAUGHT.
 *
 *   4. TEETH (unit) -- sub_0030 writes NO RAM; its outputs are registers and the
 *      rst-skip boolean. So the broken twin inverts the gate: it flips the carry
 *      flag AND the returned boolean. The unit gate catches the F divergence.
 *
 *   5. BRANCH COVERAGE (synthesized) -- within 30 frames only the carry-SET
 *      (return-true) branch runs naturally; the carry-CLEAR skip branch and the
 *      loop-count variations (B==0 -> 256 iterations, B==1, B==many) do not. So
 *      each is synthesized: clone the captured entry, force A and (BOARD), run
 *      oracle vs optimized, and diff RAM + registers + pc + the per-branch CYCLE
 *      TOTAL. Every data-dependent branch thus has committed teeth.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_0030 as translated_0030 } from "../../translated/mainloop.js";
import { sub_0030 as optimized_0030 } from "../sub_0030.js";
import { unitEquivalence } from "../harness.js";
import { convergentGate, SCENARIOS } from "./convergent.js";
import { Machine } from "../../machine.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { BOARD } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0030;
const FRAMES = 30; // sub_0030 fires from frame 5, ~26× within this window
const F_C = 0x01; // Z80 carry-flag bit (core/cpu/z80.js)

/**
 * Deliberately-broken twin (unit): the optimized routine EXCEPT the gate result is
 * inverted -- the carry flag is flipped and the returned skip-boolean is flipped.
 * These are the routine's only observable outputs (it makes no RAM store), so
 * this is the representative "wrong result to one of the routine's own outputs"
 * bug the gate must catch: the flipped F shows up in the unit register diff.
 */
function broken_0030(m) {
  const ret = optimized_0030(m);
  m.regs.f ^= F_C;
  return !ret;
}

/**
 * Cycle-broken twin for the CONVERGENT gate: identical to the collapsed routine
 * except the prologue block's charge (hit on EVERY invocation, from frame 5) is
 * 5 t short. A wrong total shifts the main loop's spin count -- the PRNG entropy at
 * 0x6019 -- so the RANDOM stream FORKS: a PERSISTENT divergence, never a heal. A
 * value-corruption twin would break a game invariant and hang a long whole-machine
 * run, so the value teeth stays at the fast unit level above.
 */
function cyclebroken_0030(m) {
  const { regs, mem } = m;

  regs.hl = BOARD;
  regs.b = mem.read8(regs.hl);
  m.step(0x0048, 29 - 5); // DROPPED: the correct charge here is 29 t

  do {
    regs.rrca();
    regs.djnz();
    const looping = regs.b !== 0;
    m.step(looping ? 0x0048 : 0x004b, looping ? 17 : 12);
  } while (regs.b !== 0);

  if (regs.fC) {
    m.ret(11);
    return true;
  }

  regs.hl = m.pop16();
  m.step(0x004d, 15);
  m.ret();
  return false;
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine): collapsed sub_0030 CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  const r = convergentGate(new Map([[TARGET, optimized_0030]]), { scenario: SCENARIOS.attract });

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

test("EQUAL (unit): idiomatic optimized sub_0030 matches translated in RAM + registers", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_0030, optimized_0030);

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical");
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG — a PERSISTENT divergence, CAUGHT", () => {
  const r = convergentGate(new Map([[TARGET, cyclebroken_0030]]), { scenario: SCENARIOS.attract });

  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.pass, false, "convergent gate FAILED to catch a wrong cycle total — it is worthless");
  assert.ok(
    r.statePersistent.length > 0 || r.pixelPersistent,
    "a caught divergence must be persistent (non-stack state or pixels)",
  );
  console.log(
    `  TEETH/convergent: caught — persistent non-stack addrs ${r.statePersistent.length}` +
      `${r.statePersistent.length ? " (" + r.statePersistent.slice(0, 4).map((s) => "0x" + s.addr.toString(16)).join(",") + ")" : ""}, ` +
      `pixelPersistent ${r.pixelPersistent}`,
  );
});

test("TEETH (unit): an inverted gate result is CAUGHT and names the carry flag F", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_0030, broken_0030);

  assert.equal(r.equal, false, "harness FAILED to catch a wrong gate result — it is worthless");
  // sub_0030 stores no RAM: the divergence is a register (F), not a RAM address.
  assert.equal(r.ram, null, "sub_0030 makes no RAM store, so the diff must be a register");
  assert.ok(r.regs != null, "a caught divergence must name a register");
  assert.equal(
    r.regs.reg,
    "f",
    `expected the diff on the carry flag F, got register '${r.regs?.reg}'`,
  );
  console.log(
    `  TEETH/unit: caught at register ${r.regs.reg} ` +
      `(translated 0x${r.regs.a.toString(16)} vs broken 0x${r.regs.b.toString(16)})`,
  );
});

// -- BRANCH COVERAGE (synthesized) --------------------------------------------

/**
 * Capture a pristine machine at the first natural entry of sub_0030 (frame 5),
 * exactly as unitEquivalence does, so synthesized branches start from a real,
 * clonable mid-attract state.
 */
function captureEntry() {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_0030(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(FRAMES);
  assert.ok(entry !== null, "failed to capture a sub_0030 entry");
  return entry;
}

/**
 * Force (A, BOARD) on two clones of the captured entry, run oracle vs optimized,
 * and diff RAM + registers + pc + the per-branch cycle total.
 */
function diffBranch(entry, a, boardVal) {
  const ca = entry.clone();
  const cb = entry.clone();
  ca.regs.a = a & 0xff;
  cb.regs.a = a & 0xff;
  ca.mem.write8(BOARD, boardVal & 0xff);
  cb.mem.write8(BOARD, boardVal & 0xff);

  const cycA0 = ca.cycles;
  const cycB0 = cb.cycles;
  translated_0030(ca);
  optimized_0030(cb);
  const cyclesA = ca.cycles - cycA0;
  const cyclesB = cb.cycles - cycB0;

  return {
    ram: firstStateDiff(ca.dumpState(), cb.dumpState(), (off) => ca.stateOffsetToAddr(off)),
    regs: firstRegDiff(ca.regs, cb.regs),
    pc: ca.pc === cb.pc ? null : { a: ca.pc, b: cb.pc },
    cyclesA,
    cyclesB,
  };
}

test("BRANCH COVERAGE: every data-dependent branch is EQUAL (RAM + regs + pc + cycles)", () => {
  const entry = captureEntry();

  // [A, BOARD-value, label] -- covers loop 0(->256)/1/many × carry set/clear.
  const cases = [
    [0x01, 1, "B=1 loop-once, carry SET -> return true (natural branch)"],
    [0x00, 1, "B=1 loop-once, carry CLEAR -> pop hl + skip (return false)"],
    [0xff, 0, "B=0 -> 256 rotations (djnz underflow), carry SET"],
    [0x00, 0, "B=0 -> 256 rotations, carry CLEAR -> skip"],
    [0xaa, 3, "B=3 loop-many, carry SET"],
    [0x08, 3, "B=3 loop-many, carry CLEAR -> skip"],
    [0x80, 8, "B=8 selects bit 7, carry SET"],
  ];

  for (const [a, board, label] of cases) {
    const d = diffBranch(entry, a, board);
    assert.equal(d.ram, null, `${label}: RAM diff at 0x${d.ram?.addr?.toString(16)}`);
    assert.equal(d.regs, null, `${label}: reg diff at ${d.regs?.reg} (${d.regs?.a} vs ${d.regs?.b})`);
    assert.equal(d.pc, null, `${label}: pc diff ${JSON.stringify(d.pc)}`);
    assert.equal(
      d.cyclesA,
      d.cyclesB,
      `${label}: cycle total diverged (oracle ${d.cyclesA} vs optimized ${d.cyclesB})`,
    );
  }
  console.log(`  BRANCH: ${cases.length} synthesized branches EQUAL (RAM + regs + pc + cycle total)`);
});
