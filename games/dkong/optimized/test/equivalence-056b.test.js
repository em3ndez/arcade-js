// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for draw_056b (ROM 0x056B): pick the score's VRAM
 * tilemap column from A, then tail-join the BCD renderer draw_0578.
 *
 * draw_056b is a LEAF reached only via `m.call(0x056b)` from two MAIN-LOOP tasks
 * (entry_051c @0x053B, handler_05c6 @0x05D7). Being main-loop-reached it is
 * NON-ATOMIC, so its cycle charges are COLLAPSED and licensed by the CONVERGENT
 * gate (optimized/draw_056b.js header explains why: a mid-routine NMI can at most
 * push a coarse PC/F into the dead stack or leave a healing pixel tear, never a
 * persistent divergence).
 *
 * Jobs:
 *   1. CONVERGENT (whole-machine) — the idiomatic COLLAPSED draw_056b converges
 *      against its oracle over a long driven run (pixels + persistent non-stack
 *      state); the override must actually fire.
 *   2. EQUAL (unit) — RAM + all registers (incl. F) + pc identical on the
 *      NATURAL entry (A == 0, the P1 / Z-branch).
 *   3. BRANCH COVERAGE — the natural run only exercises A == 0. The A != 0
 *      (P2 / not-Z, IX = 0x7521) branch is SYNTHESISED by cloning the captured
 *      entry and forcing A, then diffing oracle vs optimized RAM+regs+pc. Both
 *      branches are asserted EQUAL, and each branch's cycle TOTAL is asserted
 *      equal to the oracle's, giving the collapsed per-branch charges (30 T /
 *      51 T) teeth.
 *   4. TEETH (convergent + unit) — a cycle-drop twin (convergent, catches a
 *      forked PRNG) and a deliberately-broken VALUE twin (unit scale, first VRAM
 *      store at 0x7781 lands a wrong value) must both be CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Machine } from "../../machine.js";
import { draw_056b as translated_056b } from "../../translated/mainloop.js";
import { draw_056b as optimized_056b } from "../draw_056b.js";
import { unitEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { convergentGate, SCENARIOS } from "./convergent.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x056b;
const FRAMES = 30; // draw_056b fires exactly once, at frame 5

// The first store on the routine's rendered path is the P1 score's most-
// significant digit, written by sub_0593 (reached through draw_0578 -> loop_0583)
// to VRAM 0x7781 -- inside the compared state dump (video RAM 0x7400-0x77FF).
// draw_056b fires only at frame 5, so the corrupted cell is not rewritten and
// the diff persists. (0x7781 is the P1 column base; A==0 selects it.)
const BROKEN_ADDR = 0x7781;

/**
 * Deliberately-broken twin: behaviourally the optimized draw_056b EXCEPT the
 * first store to 0x7781 lands a wrong value (correct char XOR 0xFF, guaranteed
 * to differ). Every other write — and every subroutine it tail-joins — runs
 * verbatim, so this is the representative "wrong value to one of the routine's
 * own output cells" bug the gate must catch.
 */
function broken_056b(m) {
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
    return optimized_056b(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

// Capture the pristine machine at the first entry of draw_056b, so a branch the
// natural run does not reach can be SYNTHESISED by cloning it and forcing A.
function captureEntry() {
  let entry = null;
  const snapshot = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_056b(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snapshot });
  host.runFrames(FRAMES);
  assert.ok(entry !== null, `draw_056b never entered within ${FRAMES} frames`);
  return entry;
}

// Measure the T-states one implementation charges across a single run on `base`
// (with A forced to `aVal`), and return { cycles, machine } for a state diff.
function runBranch(base, aVal, fn) {
  const mm = base.clone();
  mm.regs.a = aVal;
  const before = mm.cycles;
  fn(mm);
  return { cycles: mm.cycles - before, machine: mm };
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine): collapsed draw_056b CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  // draw_056b is COLLAPSED and INTERRUPTIBLE (main-loop task, NMI mask enabled), so
  // the strict byte-exact gate is the wrong tool here -- see optimized/draw_056b.js.
  const r = convergentGate(new Map([[TARGET, optimized_056b]]), { scenario: SCENARIOS.attract });

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

test("EQUAL (unit): idiomatic optimized draw_056b matches translated in RAM + registers", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_056b, optimized_056b);

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F) + pc identical (natural entry, A==0)");
});

// -- BRANCH COVERAGE ----------------------------------------------------------

test("BRANCH COVERAGE: both A==0 (P1/0x7781) and A!=0 (P2/0x7521) columns prove EQUAL", () => {
  const entry = captureEntry();
  const oracleDumps = {}; // keep each branch's oracle dump to prove they diverge

  for (const [label, aVal, colCell] of [
    ["A==0 (Z taken, P1 column)", 0x00, 0x7781],
    ["A!=0 (Z not taken, P2 column)", 0x01, 0x7521],
  ]) {
    const oracle = runBranch(entry, aVal, translated_056b);
    const opt = runBranch(entry, aVal, optimized_056b);

    const ram = firstStateDiff(
      oracle.machine.dumpState(),
      opt.machine.dumpState(),
      (off) => oracle.machine.stateOffsetToAddr(off),
    );
    const regs = firstRegDiff(oracle.machine.regs, opt.machine.regs);

    assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${ram.addr.toString(16)}` : "");
    assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg}` : "");
    assert.equal(oracle.machine.pc, opt.machine.pc, `${label}: pc must match`);
    // Not required (no branch is collapsed), but assert the totals match the
    // oracle so a mistaken cycle change on either branch has teeth too.
    assert.equal(opt.cycles, oracle.cycles, `${label}: cycle total must match the oracle`);
    // Sanity: this branch really rendered into ITS column base cell (draw_0578
    // walks IX away from the base afterwards, so read the tilemap cell itself,
    // not IX). The oracle and optimized read identical here already, so read
    // from the optimized machine.
    assert.equal(
      opt.machine.mem.read8(colCell),
      oracle.machine.mem.read8(colCell),
      `${label}: column base cell 0x${colCell.toString(16)} must match the oracle`,
    );
    oracleDumps[aVal] = oracle.machine.dumpState();
    console.log(`  BRANCH ${label}: EQUAL (RAM+regs+pc), ${opt.cycles} T on both sides`);
  }

  // The two branches must genuinely diverge, or "coverage" is an illusion: A==0
  // draws into the P1 column region and A!=0 into the P2 column region.
  const branchesDiffer = firstStateDiff(oracleDumps[0x00], oracleDumps[0x01]);
  assert.ok(
    branchesDiffer != null,
    "the A==0 and A!=0 branches produced identical memory — they were not both exercised",
  );
  console.log(
    `  BRANCH divergence confirmed: A==0 vs A!=0 dumps differ at offset ${branchesDiffer.offset}`,
  );
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  // The convergent gate tolerates transient tears but MUST catch a real (non-healing)
  // error. A short charge shifts the main-loop spin count (0x6019, PRNG entropy),
  // forking the RANDOM stream permanently -- never a value-corruption twin over a long
  // convergent run (it can hang instead of diverging cleanly; the unit TEETH below
  // covers that case at routine-boundary scale).
  function cyclebroken_056b(m) {
    const { regs } = m;
    const VRAM_SCORE_COL_P1 = 0x7781;
    const VRAM_SCORE_COL_P2 = 0x7521;
    regs.ix = VRAM_SCORE_COL_P1;
    regs.and(regs.a);
    m.step(0x0570, 13); // DROPPED: correct total is 18 t (14 + 4), short by 5
    if (regs.fZ) { m.step(0x057c, 12); } else { regs.ix = VRAM_SCORE_COL_P2; m.step(0x057c, 33); }
    return m.call(0x0578, true);
  }
  const r = convergentGate(new Map([[TARGET, cyclebroken_056b]]), { scenario: SCENARIOS.attract });

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

test("TEETH (unit): a wrong score-digit store is CAUGHT and names 0x7781", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_056b, broken_056b);

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
