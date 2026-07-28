// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence-harness tests for sub_286f (the per-BOARD collision-handler DISPATCH:
 * read BOARD as an index, `push hl`, `rst 0x28` into the jump-table dispatcher
 * sub_0028 @ 0x0028). A dispatch node in game-state-3 gameplay, reached via
 * `m.call(0x286f)` from sub_2808 (@0x2816) and loc_281d (@0x283e), which the
 * interruptible per-frame update cascade loc_197a drives. Measured: 816 dispatches
 * in a 1400-frame ATTRACT run, first entry at frame ~586, every one with BOARD=1
 * (attract's demo plays 25m -> table[1]=0x2880 -> sub_2880). The unit gate reaches
 * it because the snapshot override is installed at CONSTRUCTION, so it fires however
 * the routine is entered (dispatch OR m.call).
 *
 * Seven jobs:
 *
 *   1. CONVERGENT (whole-machine) -- sub_286f is COLLAPSED (one m.step for its whole
 *      straight-line block) and INTERRUPTIBLE, so the strict byte-exact gate would
 *      false-fail on a mistimed-NMI raster tear + the coarse PC pushed into the dead
 *      stack. The convergent gate is the correct license. It runs the ATTRACT
 *      scenario (the GAMEPLAY default does not reach this routine within 1200
 *      frames; attract's demo play dispatches it hundreds of times from frame ~586).
 *
 *   2. DISPATCH -- the override must actually fire, or EQUAL is vacuous. sub_286f
 *      fires hundreds of times in the attract window; the natural entry has BOARD=1.
 *
 *   3. EQUAL (unit) -- translated vs optimized leave identical RAM + registers
 *      (incl. F, which nothing here writes, so it is carried through; and A/HL/SP) +
 *      pc, from the captured natural entry -- exercising the FULL dispatch subtree
 *      (sub_0028 -> sub_2880), since m.call(0x0028) resolves to the shared oracle on
 *      both sides. maxFrames=700 because the first entry is at frame ~586, past the
 *      unit gate's 240-frame default.
 *
 *   4. CONTRACT COVERAGE + CYCLE TOTAL -- sub_286f has NO data-dependent branch (a
 *      single basic block; the index only steers sub_0028's subtree), so there is one
 *      arm. Two proofs:
 *        (a) END-TO-END, natural BOARD=1: translated vs optimized identical
 *            RAM + regs + pc + SP AND o.cycles == p.cycles across the REAL subtree --
 *            the collapse preserves the whole dispatched total, not just the prologue.
 *        (b) ISOLATED via a 0x0028 STUB (charges 0, does not pop/dispatch), driven at
 *            BOARD = 0/1/2/3 on BOTH sides: proves the routine reads the LIVE index
 *            (A == BOARD, not a hardcoded value), pushes HL then the table base 0x2874
 *            in that order, leaves SP = entry-4, and charges its OWN block total of
 *            exactly 35 t (13+11+11) -- pinned absolute, index-independent (structural
 *            teeth for a wrong collapsed total on any index arm).
 *
 *   5. BRANCH-TEETH (cycles) -- a twin that drops 5 t from the block charge yields a
 *      wrong own-total (30 vs 35) and is CAUGHT, proving the cycle-total assertion has
 *      teeth.
 *
 *   6. TEETH (convergent) -- a cycle-broken twin (5 t short) shifts the main loop's
 *      spin count 0x6019 (the PRNG entropy), forking the RANDOM stream PERMANENTLY;
 *      the convergent gate CATCHES it as a PERSISTENT non-stack divergence.
 *
 *   7. TEETH (unit, value) -- a broken twin whose first store (the `push hl` low byte
 *      at SP) lands the wrong value (XOR 0xFF) is CAUGHT: NOT-EQUAL, naming that stack
 *      address. Run under the 0x0028 stub so the corrupted push is NOT masked -- in a
 *      full run the dispatched subtree's own pushes overwrite the same stack slots
 *      (the "re-poked output" wrinkle, docs/decompiler-pipeline), so the unit teeth targets the
 *      routine's own store directly with the subtree stubbed off.
 *
 * THE CYCLE DECISION this routine records: sub_286f is COLLAPSED to ONE m.step. Its
 * three instruction charges (13+11+11 = 35 t, exit PC 0x0028 = the rst target) fold
 * into a single charge; total-preservation keeps the spin count / PRNG deterministic.
 * It is NOT atomic (the NMI can land in its 35 t window via the loc_197a cascade /
 * attract), so the collapse is LICENSED by the CONVERGENT gate, not the strict one.
 * Its only stores are the two stack pushes (WORK RAM near 0x6BFF) -- no 0x7Dxx
 * hardware latch -- so there is NO hardware bus cycle to pin and NO write-trace test.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_286f as translated_286f } from "../../translated/state0.js";
import { sub_286f as optimized_286f } from "../sub_286f.js";
import { unitEquivalence } from "../harness.js";
import { convergentGate, SCENARIOS } from "./convergent.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";
import { Machine } from "../../machine.js";
import { BOARD } from "../ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT
  ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR)))
  : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x286f;
const DISPATCHER = 0x0028; // rst 0x28 -> sub_0028
const CAPTURE_FRAMES = 700; // first natural (attract) entry is at frame ~586
const OWN_CYCLES = 35;      // sub_286f's own block: ld a 13 + push hl 11 + rst 11
const TABLE_BASE = 0x2874;  // the rst-0x28 inline jump-table base pushed as its "return"
const SITE = "0x2874 (0x6227 collision dispatch)";

/**
 * A stub for 0x0028 that ISOLATES sub_286f's prologue: it records the index A and SP
 * the dispatcher was entered with, charges NO cycles, and returns WITHOUT popping the
 * table base or dispatching. Installed identically on both sides, so the measured
 * cycles are sub_286f's OWN 35 t and the prologue's two stack pushes survive
 * un-overwritten (a real subtree would pop + overwrite them).
 */
function makeStub(rec) {
  return (mm /*, site */) => {
    rec.index = mm.regs.a;
    rec.sp = mm.regs.sp;
    return undefined;
  };
}

/**
 * Deliberately-broken twin: behaviourally the optimized routine EXCEPT the first
 * store (the `push hl` low byte at SP) lands a wrong value (XOR 0xFF, guaranteed to
 * differ). Catches a "wrong value to the routine's own output store" bug. Meaningful
 * only with the subtree stubbed (else the subtree overwrites the slot).
 */
function broken_286f(m) {
  const realWrite = m.mem.write8.bind(m.mem);
  let broke = false;
  m.mem.write8 = (addr, value, busOffset) => {
    if (!broke) {
      broke = true;
      return realWrite(addr, value ^ 0xff, busOffset);
    }
    return realWrite(addr, value, busOffset);
  };
  try {
    return optimized_286f(m);
  } finally {
    m.mem.write8 = realWrite;
  }
}

/**
 * Cycle-broken twin for the CONVERGENT gate: identical memory + registers to the
 * collapsed routine, but the block charge is 5 t short, so the path total no longer
 * matches the oracle. Wrong totals shift the spin count (0x6019, the PRNG entropy),
 * forking the RANDOM stream -- a PERSISTENT non-stack divergence, never a heal. Teeth
 * for the collapse's load-bearing invariant (total-cycle preservation).
 */
function cyclebroken_286f(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(BOARD);
  m.push16(regs.hl);
  m.push16(TABLE_BASE);
  m.step(DISPATCHER, OWN_CYCLES - 5); // DROPPED: the correct charge here is 35 t
  m.call(DISPATCHER, SITE);
}

/** Capture the pristine machine the instant sub_286f is first entered (via m.call).
 *  A constructor override snapshots the entry, then delegates to the translated
 *  oracle so the host run proceeds normally to a clean stop. */
function captureEntry(maxFrames = CAPTURE_FRAMES) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_286f(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(maxFrames);
  if (entry === null) throw new Error(`0x${TARGET.toString(16)} never entered in ${maxFrames} frames`);
  return entry;
}

/** Clone `entry`, run `fn`, and report the full contract: SP + PC, the machine, and
 *  the cycles the routine charged (relative to entry, so it is base-independent). */
function runBranch(entry, fn) {
  const c = entry.clone();
  const c0 = c.cycles;
  const ret = fn(c);
  return { ret, cycles: c.cycles - c0, sp: c.regs.sp, pc: c.pc, machine: c };
}

/** Clone `entry`, poke BOARD := `board`, install the 0x0028 stub, run `fn`, and report
 *  the isolated-prologue contract (own cycles, SP, the recorded dispatch index). */
function runIsolated(entry, board, fn) {
  const c = entry.clone();
  c.mem.write8(BOARD, board);
  const rec = {};
  c.routines.set(DISPATCHER, makeStub(rec));
  const c0 = c.cycles;
  fn(c);
  return { cycles: c.cycles - c0, sp: c.regs.sp, index: rec.index, stubSp: rec.sp, machine: c };
}

// -- EQUAL --------------------------------------------------------------------

test("CONVERGENT (whole-machine): collapsed sub_286f CONVERGES vs translated (pixels + persistent non-stack state)", () => {
  // sub_286f is COLLAPSED and INTERRUPTIBLE; the ATTRACT scenario reaches it (the
  // GAMEPLAY default does not within 1200 frames).
  const r = convergentGate(new Map([[TARGET, optimized_286f]]), { scenario: SCENARIOS.attract });

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

test("EQUAL (unit): idiomatic optimized sub_286f matches translated in RAM + registers", () => {
  const r = unitEquivalence(ROM, {}, TARGET, translated_286f, optimized_286f, { maxFrames: CAPTURE_FRAMES });

  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${r.ram.addr.toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.equal(r.pc, null, "pc must match");
  assert.equal(r.equal, true);
  console.log("  EQUAL/unit: RAM + all registers (incl. F, A, HL, SP) + pc identical (natural BOARD=1 entry, full subtree)");
});

// -- CONTRACT COVERAGE + CYCLE TOTAL -----------------------------------------

test("CONTRACT (unit, end-to-end): natural BOARD=1 -- full dispatch subtree EQUAL + cycle total", () => {
  const entry = captureEntry();
  const o = runBranch(entry, translated_286f);
  const p = runBranch(entry, optimized_286f);

  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(o.machine.regs, p.machine.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");
  assert.equal(o.pc, p.pc, "pc must match between oracle and optimized");
  assert.equal(o.sp, p.sp, "SP must match the oracle");
  // Cycles are NOT in the RAM+regs dump; the collapse must preserve the WHOLE
  // dispatched total (prologue 35 t + the deterministic sub_0028->sub_2880 subtree).
  assert.equal(o.cycles, p.cycles, "cycle total must match the oracle across the real subtree");
  assert.equal(entry.mem.read8(BOARD), 0x01, "attract entry dispatches BOARD=1 (table[1]=0x2880)");
  console.log(`  CONTRACT/end-to-end: EQUAL -- SP 0x${p.sp.toString(16)}, ${p.cycles} t (subtree incl.), BOARD=1`);
});

/** Prove the isolated prologue arm at a chosen BOARD index: reads the LIVE index,
 *  pushes HL then 0x2874, leaves SP=entry-4, and charges exactly 35 t. Oracle and
 *  optimized compared byte-for-byte with the subtree stubbed off. */
function assertPrologue(board) {
  const entry = captureEntry();
  const sp0 = entry.regs.sp;
  const o = runIsolated(entry, board, translated_286f);
  const p = runIsolated(entry, board, optimized_286f);

  const ram = firstStateDiff(o.machine.dumpState(), p.machine.dumpState(), (off) => o.machine.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(o.machine.regs, p.machine.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg}` : "");

  // Reads the LIVE index (A == BOARD), not a hardcoded value.
  assert.equal(p.index, board, `dispatcher entered with A == BOARD (0x${board.toString(16)})`);
  assert.equal(o.index, board, "oracle likewise reads the live index");

  // Pushes HL then the table base 0x2874, in that order: SP = entry - 4, and the two
  // 16-bit slots hold 0x2874 (top) then the entry HL (below).
  assert.equal(p.sp, (sp0 - 4) & 0xffff, "SP = entry - 4 (two 16-bit pushes)");
  assert.equal(o.sp, p.sp, "SP matches the oracle");
  const rd16 = (mm, a) => mm.mem.read8(a & 0xffff) | (mm.mem.read8((a + 1) & 0xffff) << 8);
  assert.equal(rd16(p.machine, (sp0 - 4) & 0xffff), TABLE_BASE, "table base 0x2874 on top of stack");
  assert.equal(rd16(p.machine, (sp0 - 2) & 0xffff), entry.regs.hl & 0xffff, "saved HL just below it");

  // OWN block total, pinned absolute (index-independent): exactly 35 t.
  assert.equal(o.cycles, OWN_CYCLES, `oracle own-block total should be ${OWN_CYCLES} t`);
  assert.equal(p.cycles, o.cycles, "optimized own-block total must match the oracle");
  console.log(
    `  CONTRACT/BOARD=0x${board.toString(16)}: EQUAL -- index A=0x${p.index.toString(16)}, ` +
      `SP 0x${p.sp.toString(16)} (entry-4), ${p.cycles} t`,
  );
}

test("CONTRACT (unit, isolated): natural index BOARD=1 -- live A, HL+0x2874 pushed, 35 t", () => {
  assertPrologue(0x01);
});

test("CONTRACT (unit, isolated): synthesised BOARD=0 -- reads live index (not hardcoded), 35 t", () => {
  assertPrologue(0x00);
});

test("CONTRACT (unit, isolated): synthesised BOARD=2 -- reads live index, 35 t", () => {
  assertPrologue(0x02);
});

test("CONTRACT (unit, isolated): synthesised BOARD=3 -- reads live index, 35 t", () => {
  assertPrologue(0x03);
});

test("BRANCH-TEETH (cycles): a dropped m.step charge yields a wrong total and is CAUGHT", () => {
  const entry = captureEntry();
  const good = runIsolated(entry, 0x01, optimized_286f);
  const dropped = runIsolated(entry, 0x01, cyclebroken_286f); // 5 t short
  assert.equal(good.cycles, OWN_CYCLES, `the correct own total is ${OWN_CYCLES} t`);
  assert.notEqual(dropped.cycles, good.cycles, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH: correct ${good.cycles} t vs dropped-charge ${dropped.cycles} t -- caught`);
});

// -- TEETH --------------------------------------------------------------------

test("TEETH (convergent): a WRONG CYCLE TOTAL forks the PRNG -- a PERSISTENT divergence, CAUGHT", () => {
  // The convergent gate tolerates transient tears but MUST catch a real (non-healing)
  // error. The collapse's load-bearing invariant is total-cycle preservation; a short
  // charge shifts the spin count 0x6019 (PRNG entropy), forking the RANDOM stream.
  const r = convergentGate(new Map([[TARGET, cyclebroken_286f]]), { scenario: SCENARIOS.attract });

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

test("TEETH (unit): a wrong `push hl` store is CAUGHT and names the stack slot", () => {
  const entry = captureEntry();
  const expectedAddr = (entry.regs.sp - 2) & 0xffff; // push hl writes its low byte here

  // Run BOTH under the 0x0028 stub so the prologue's pushes are not overwritten by a
  // dispatched subtree (which would mask the corrupted store).
  const a = entry.clone();
  const b = entry.clone();
  a.routines.set(DISPATCHER, makeStub({}));
  b.routines.set(DISPATCHER, makeStub({}));
  translated_286f(a);
  broken_286f(b);
  const ram = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));

  assert.ok(ram != null, "harness FAILED to catch a wrong store -- it is worthless");
  assert.equal(
    ram.addr, expectedAddr,
    `expected first diff at the corrupted push slot 0x${expectedAddr.toString(16)}, got 0x${ram.addr.toString(16)}`,
  );
  console.log(`  TEETH/unit: caught at 0x${ram.addr.toString(16)} (translated ${ram.a} vs broken ${ram.b})`);
});
