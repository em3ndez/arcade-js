// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for entry_33c3 -- the BOARD-gated wrapper at ROM 0x33c3 that, on
 * BOARD(0x6227) == 1, loads an object record's +0e/+0f/+0d bytes into H/L/B, runs
 * entry_2333 (the coordinate clamp/step, resolved through the registry), and stores the
 * returned L back into +0f; on any other board it early-returns untouched. See
 * optimized/entry_33c3.js for the full behaviour block.
 *
 * COLLAPSED: two straight-line blocks fold to one m.step each (prologue 20 t @0x33C8;
 * ret-not-taken + 3 record loads 62 t @0x33D2); the CALL 0x2333 boundary and both `ret`s
 * are kept verbatim. Per-arm OWN totals (callee excluded): BOARD!=1 = 31 t, BOARD==1 = 128 t.
 *
 * GATE = STRICT byte-exact whole-machine (the routine is ATOMIC, so no convergent gate).
 * MEASURED over 1400 attract frames: 204 dispatches, io.nmiMask == 0 at 204/204 (every call
 * INSIDE the vblank NMI; outside-NMI 0), and the NMI's pushed PC never lands in the interleaved
 * 33c3/33ad body [0x33AD,0x33E5] (0 over 1394 NMIs; 0 anywhere in 0x3000-0x34FF; all landings in
 * the 0x02BD-0x0372 main-loop band). Atomic + total-preserving => byte-exact. First dispatch is
 * ~frame 938 (deep in loc_197a's NMI object cascade: 30ed -> 31b1 -> 3202 -> 33ad -> here), so the
 * unit host runs 1000 frames to capture it.
 *
 * BRANCH COVERAGE: attract exercises ONLY the BOARD==1 (continue) arm -- all 204 dispatches see
 * 0x6227 == 1 (the demo plays 25m). The BOARD!=1 early-ret arm is proven from a crafted
 * identical-both-sides poke, with its exact 31 t total pinned.
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth; UNIT EQUAL on
 * the natural first entry (continue arm) and its behavioural teeth; FULL-BRANCH coverage of both
 * arms from crafted pokes (EQUAL over RAM+regs+pc+SP AND each arm's exact cycle TOTAL); a store-drop
 * behavioural twin and a dropped-charge cycle twin, both CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { entry_33c3 as translated_33c3 } from "../../translated/state0.js";
import { entry_33c3 as optimized_33c3 } from "../entry_33c3.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x33c3;
const FRAMES_WHOLE = 1400; // past the ~f938 first dispatch; 204 invocations (all continue arm)
const FRAMES_UNIT = 1000; // the unit host must run past the first dispatch (~f938) to capture it

const RET_ADDR = 0x4d17; // sentinel caller-return address for crafted entries
const IX_BASE = 0x6a00;  // work-RAM object record base for crafted entries (NOT a hardware latch)

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ----------------

test("STRICT (whole-machine): entry_33c3 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_33c3]]));
  const fired = r.invocations.get(TARGET);
  assert.ok(fired >= 1, `override at 0x${TARGET.toString(16)} never dispatched (invocations=${fired})`);
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `NOT byte-exact: frame ${r.frame} addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
  console.log(`  STRICT: byte-exact over ${r.framesCompared} frames, fired ${fired}x (atomic)`);
});

test("STRICT-TEETH (cycles): a wrong prologue charge forks the trajectory and is CAUGHT", () => {
  // The load-bearing invariant is total-cycle preservation. Charging the prologue 19 t
  // instead of 20 shifts the frame's cycle budget -> the spin count 0x6019 (PRNG entropy)
  // and where a later NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    const rec = (off) => (regs.ix + off) & 0xffff;
    regs.a = mem.read8(0x6227);
    regs.cp(0x01);
    m.step(0x33c8, 19); // DROPPED: prologue is 20 t
    if (regs.fNZ) { m.ret(11); return; }
    regs.h = mem.read8(rec(0x0e));
    regs.l = mem.read8(rec(0x0f));
    regs.b = mem.read8(rec(0x0d));
    m.step(0x33d2, 62);
    m.push16(0x33d5);
    m.step(0x2333, 17);
    m.call(0x2333);
    mem.write8(rec(0x0f), regs.l);
    m.step(0x33d8, 19);
    m.ret();
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry -- the continue arm) ----------------------------

/** Capture the pristine machine the instant entry_33c3 is first entered (via m.call,
 *  deep in the NMI cascade). The snapshot override is wired at CONSTRUCTION so it fires
 *  however the routine is reached, then delegates to the oracle so the host proceeds. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_33c3(mm);
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
  translated_33c3(a);
  fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    a, b,
  };
}

test("EQUAL (unit): idiomatic entry_33c3 matches translated in RAM + full register file + pc", () => {
  // Sanity: the natural first entry is the BOARD==1 (continue) arm.
  assert.equal(NATURAL_ENTRY.mem.read8(0x6227), 1, "natural entry should be on BOARD==1 (25m)");
  const r = runBoth(NATURAL_ENTRY, optimized_33c3);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F, SP) + pc identical (natural continue entry)");
});

test("TEETH (unit behavioural): inverting the BOARD gate is CAUGHT on the natural entry", () => {
  // The natural first entry takes the CONTINUE arm (BOARD==1). A twin that inverts the gate
  // (returns when it should continue) skips the field load, the entry_2333 step, and the store,
  // so its RAM (missing +0f store), registers (A/HL are BOARD/untouched, not entry_2333's) and
  // cycle path all diverge from the oracle's continue arm.
  const broken_invertGate = (m) => {
    const { regs, mem } = m;
    const rec = (off) => (regs.ix + off) & 0xffff;
    regs.a = mem.read8(0x6227);
    regs.cp(0x01);
    m.step(0x33c8, 20);
    if (regs.fZ) { m.ret(11); return; } // BUG: inverted -- bails on the continue arm
    regs.h = mem.read8(rec(0x0e));
    regs.l = mem.read8(rec(0x0f));
    regs.b = mem.read8(rec(0x0d));
    m.step(0x33d2, 62);
    m.push16(0x33d5);
    m.step(0x2333, 17);
    m.call(0x2333);
    mem.write8(rec(0x0f), regs.l);
    m.step(0x33d8, 19);
    m.ret();
  };
  const r = runBoth(NATURAL_ENTRY, broken_invertGate);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual;
  assert.ok(caught, "unit gate FAILED to catch an inverted BOARD gate -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${!r.pcEqual ? "pc" : !r.spEqual ? "SP" : r.regs ? r.regs.reg : "ram"} diverged`);
});

// -- FULL-BRANCH COVERAGE (crafted identical-both-sides pokes: both arms) --------

/**
 * Fresh machine with a valid stack (a sentinel caller-return frame), BOARD poked, and IX
 * pointing at a work-RAM record whose +0d/+0e/+0f are seeded -- the sanctioned
 * identical-both-sides poke (the decompiler-pipeline doc pattern 3), applied to both oracle and optimized clones.
 *   - board != 1                 -> early-ret arm, no field work        (31 t, no callee)
 *   - board == 1 + H/L/B fields  -> continue arm: load, entry_2333, store (deterministic total)
 */
function seed({ board, fields }) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(RET_ADDR); // entry_33c3's own caller-return frame
  const entrySP = m.regs.sp;
  m.mem.write8(0x6227, board);
  m.regs.ix = IX_BASE;
  if (fields) {
    m.mem.write8((IX_BASE + 0x0e) & 0xffff, fields.h);
    m.mem.write8((IX_BASE + 0x0f) & 0xffff, fields.l);
    m.mem.write8((IX_BASE + 0x0d) & 0xffff, fields.b);
  }
  return { m, entrySP };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP) AND pin its exact cycle total:
 *  optimized must equal the oracle, and (regression guard) the oracle total must equal
 *  the structural constant `expectCycles`. */
function assertArm(label, opts, expectCycles) {
  const a = seed(opts);
  const b = seed(opts);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_33c3(a.m);
  optimized_33c3(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;

  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg}` : "");
  assert.equal(a.m.pc, b.m.pc, `${label}: pc must match`);
  assert.equal(a.m.regs.sp, b.m.regs.sp, `${label}: SP must match`);
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs optimized ${dB} t)`);
  assert.equal(dA, expectCycles, `${label}: oracle total should be ${expectCycles} t (got ${dA})`);
  // Both arms unwind to the caller sentinel with the stack balanced (one frame consumed).
  assert.equal(b.m.pc, RET_ADDR, `${label}: must return to the caller sentinel`);
  assert.equal(b.m.regs.sp, a.entrySP + 2, `${label}: stack must be balanced`);
  console.log(`  BRANCH/${label}: EQUAL -- pc=0x${b.m.pc.toString(16)}, sp=0x${b.m.regs.sp.toString(16)}, ` +
    `${dB} t == oracle ${dA} t`);
}

test("BRANCH (unit): early-ret arm -- BOARD != 1, object untouched (31 t, no callee)", () => {
  assertArm("early-ret", { board: 0x00 }, 31);
});

test("BRANCH (unit): continue arm -- BOARD == 1, entry_2333 steps +0f and it is stored", () => {
  // H=0x9f, L=0x4c, B=0x02 drives entry_2333's 0x4C-rail step-down path: L 0x4c -> 0x4b,
  // a MEANINGFUL write to (ix+0x0f). Oracle total (incl. entry_2333) = 282 t.
  const opts = { board: 0x01, fields: { h: 0x9f, l: 0x4c, b: 0x02 } };
  assertArm("continue", opts, 282);
  const s = seed(opts);
  translated_33c3(s.m);
  assert.equal(s.m.mem.read8((IX_BASE + 0x0f) & 0xffff), 0x4b, "continue arm must store the stepped L (0x4c->0x4b)");
});

test("BRANCH-TEETH (behavioural): dropping the +0f store is CAUGHT on the continue arm", () => {
  // Same continue seed where L provably changes (0x4c->0x4b); a twin that omits the store
  // leaves (ix+0x0f) stale -> a RAM diff the gate catches.
  const opts = { board: 0x01, fields: { h: 0x9f, l: 0x4c, b: 0x02 } };
  const a = seed(opts);
  const b = seed(opts);
  const broken_noStore = (m) => {
    const { regs, mem } = m;
    const rec = (off) => (regs.ix + off) & 0xffff;
    regs.a = mem.read8(0x6227);
    regs.cp(0x01);
    m.step(0x33c8, 20);
    if (regs.fNZ) { m.ret(11); return; }
    regs.h = mem.read8(rec(0x0e));
    regs.l = mem.read8(rec(0x0f));
    regs.b = mem.read8(rec(0x0d));
    m.step(0x33d2, 62);
    m.push16(0x33d5);
    m.step(0x2333, 17);
    m.call(0x2333);
    // BUG: the store `(ix+0x0f) := L` is missing.
    m.step(0x33d8, 19);
    m.ret();
  };
  translated_33c3(a.m);
  broken_noStore(b.m);
  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.notEqual(ram, null, "behavioural gate has no teeth -- a dropped store went uncaught");
  assert.equal(ram.addr, (IX_BASE + 0x0f) & 0xffff, "the caught diff should be the missing +0f store");
  console.log(`  BRANCH-TEETH/behavioural: caught -- RAM diff at 0x${ram.addr.toString(16)} (the missing store)`);
});

test("BRANCH-TEETH (cycles): a dropped prologue charge yields a wrong total and is CAUGHT", () => {
  // Continue seed; the collapsed prologue is charged 15 t (5 short). Same behaviour, wrong total.
  const opts = { board: 0x01, fields: { h: 0x9f, l: 0x4c, b: 0x02 } };
  const a = seed(opts);
  const b = seed(opts);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_33c3(a.m);
  (function cyclebroken(m) {
    const { regs, mem } = m;
    const rec = (off) => (regs.ix + off) & 0xffff;
    regs.a = mem.read8(0x6227);
    regs.cp(0x01);
    m.step(0x33c8, 15); // DROPPED: prologue total is 20 t
    if (regs.fNZ) { m.ret(11); return; }
    regs.h = mem.read8(rec(0x0e));
    regs.l = mem.read8(rec(0x0f));
    regs.b = mem.read8(rec(0x0d));
    m.step(0x33d2, 62);
    m.push16(0x33d5);
    m.step(0x2333, 17);
    m.call(0x2333);
    mem.write8(rec(0x0f), regs.l);
    m.step(0x33d8, 19);
    m.ret();
  })(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH/cycles: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
