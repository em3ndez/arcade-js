// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_33a1 -- the rst-0x30 caller-skip gate with a `(ix+0x0f) >=
 * 0x59` threshold. THREE control-flow arms (see optimized/sub_33a1.js for the full block):
 *
 *   1. gate-fired  -- `rst 0x30` (sub_0030) selects a CLEAR bit of A=0x07 by the BOARD
 *      (0x6227) index -> sub_0030 unwinds the rst frame back to entry_333d; sub_33a1
 *      reports a NORMAL early return (returns TRUE). Exercised with BOARD=4 (bit clear).
 *   2. normal-ret  -- gate passes (BOARD=1 -> bit0 SET), (ix+0x0f) >= 0x59 -> `ret nc`
 *      returns to sub_33a1's caller (returns TRUE). This is the ONLY arm attract reaches.
 *   3. splice      -- gate passes, (ix+0x0f) < 0x59 -> `inc sp; inc sp; ret` STACK-SPLICE
 *      discards sub_33a1's OWN return frame so control lands in the caller's CALLER
 *      (entry_333d is skipped, returns FALSE). SP-mutating; attract never reaches it.
 *
 * COLLAPSED, per-arm total preserved EXACTLY. The collapse REORDERS the two `inc sp`
 * AHEAD of a single lumped `m.step(0x33ac,17)` (the oracle interleaves each `inc sp`
 * with its own step). That reorder is only observable if an NMI could fire BETWEEN the
 * two `inc sp` and push the live PC to a different SP -- but the routine is ATOMIC
 * (measured below), so no NMI lands inside it and the reorder is byte-exact. This test
 * DRIVES the splice arm from a crafted entry and confirms SP + stack bytes + pc are
 * identical to the oracle there (if they were not, the collapse would be UNSAFE).
 *
 * GATE = STRICT byte-exact whole-machine (ATOMIC, total-preserving collapse). MEASURED
 * over 1600 attract frames: 34 dispatches (first ~frame 1080, deep in loc_197a's NMI
 * object cascade 30ed -> 31b1 -> 3202 -> 333d -> here), io.nmiMask == 0 at 34/34 (every
 * call inside the vblank NMI, which cannot re-enter). All 34 are the normal-ret arm
 * (BOARD==1, (ix+0x0f) >= 0x59), so the whole-machine gate covers ONE arm; the
 * gate-fired and splice arms are proven from crafted identical-both-sides entries with
 * their exact per-arm cycle totals pinned.
 *
 * Per-arm full cycle totals (INCLUDING the sub_0030 callee, deterministic per the
 * crafted seeds): gate-fired 135 t (BOARD=4), normal-ret 107 t, splice 123 t (BOARD=1).
 *
 * Jobs: WHOLE-MACHINE strict EQUAL (+ invocation proof) and its cycle-total teeth; UNIT
 * EQUAL on the natural first entry (the normal-ret arm) and its behavioural teeth;
 * FULL-BRANCH coverage of ALL THREE arms + the 0x59 boundary from crafted entries
 * (EQUAL over RAM + full register file + pc + SP + the returned boolean AND each arm's
 * exact cycle TOTAL); a broken-splice twin, an inverted-threshold twin, and a
 * dropped-charge cycle twin, all CAUGHT.
 *
 * Run: node --test games/dkong/optimized/test/equivalence-33a1.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_33a1 as translated_33a1 } from "../../translated/state0.js";
import { sub_33a1 as optimized_33a1 } from "../sub_33a1.js";
import { Machine } from "../../machine.js";
import { wholeMachineEquivalence } from "../harness.js";
import { firstStateDiff, firstRegDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x33a1;
const FRAMES_WHOLE = 1600; // past the ~f1080 first dispatch; 34 invocations (all normal-ret arm)
const FRAMES_UNIT = 1200; // the unit host must run past the first dispatch (~f1080) to capture it

const BOARD = 0x6227;    // sub_0030 reads this as the bit index (ram.js BOARD)
const RET_ADDR = 0x33ff; // sub_33a1's OWN return frame (into entry_333d) -- popped by arms 1 & 2
const SENTINEL = 0x4dcc; // the caller's CALLER frame -- ONLY the splice arm pops this
const IX = 0x6400;       // object record base in work RAM (so (ix+0x0f) reads/diffs real RAM)
const FIELD = (IX + 0x0f) & 0xffff;

// -- WHOLE-MACHINE (strict, byte-exact -- the routine is ATOMIC) ----------------

test("STRICT (whole-machine): collapsed sub_33a1 is byte-exact EQUAL vs translated over attract", () => {
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, optimized_33a1]]));
  const fired = r.invocations.get(TARGET);
  assert.ok(fired >= 1, `override at 0x${TARGET.toString(16)} never dispatched (invocations=${fired})`);
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `NOT byte-exact: frame ${r.frame} addr 0x${(r.addr ?? 0).toString(16)} ` +
      `(baseline ${r.baseline} vs optimized ${r.optimized})`,
  );
  console.log(`  STRICT: byte-exact over ${r.framesCompared} frames, fired ${fired}x (atomic, normal-ret arm)`);
});

test("STRICT-TEETH (cycles): a wrong threshold charge forks the trajectory and is CAUGHT", () => {
  // The load-bearing invariant is per-arm total-cycle preservation. Charging the
  // threshold block 21 t instead of 26 (all 34 attract dispatches take it) shifts the
  // frame's cycle budget -> the spin count 0x6019 (PRNG entropy) and where a later
  // NMI's pushed PC lands -> the byte-exact trace diverges.
  const cyclebroken = (m) => {
    const { regs, mem } = m;
    const R = (d) => (regs.ix + d) & 0xffff;
    regs.a = 0x07;
    m.step(0x33a3, 7);
    m.push16(0x33a4);
    m.step(0x0030, 11);
    if (!m.call(0x0030)) return true;
    regs.a = mem.read8(R(0x0f));
    regs.cp(0x59);
    m.step(0x33a9, 21); // DROPPED: the correct threshold block total is 26 t
    if (regs.fNC) { m.ret(11); return true; }
    regs.sp = (regs.sp + 1) & 0xffff;
    regs.sp = (regs.sp + 1) & 0xffff;
    m.step(0x33ac, 17);
    m.ret();
    return false;
  };
  const r = wholeMachineEquivalence(ROM, {}, FRAMES_WHOLE, new Map([[TARGET, cyclebroken]]));
  assert.ok(r.invocations.get(TARGET) >= 1, "broken override must have dispatched");
  assert.equal(r.equal, false, "strict gate FAILED to catch a wrong cycle total -- it is worthless");
  console.log(`  STRICT-TEETH: caught at frame ${r.frame}, addr 0x${(r.addr ?? 0).toString(16)}`);
});

// -- UNIT (natural first entry -- measured to be the normal-ret arm) ------------

/** Capture the pristine machine the instant sub_33a1 is first entered (via m.call, deep
 *  in the NMI object cascade). The snapshot override is wired at CONSTRUCTION so it fires
 *  however the routine is reached, then delegates to the oracle so the host proceeds. */
function captureEntry(maxFrames = FRAMES_UNIT) {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => {
    if (entry === null) entry = mm.clone();
    return translated_33a1(mm);
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
  const ra = translated_33a1(a);
  const rb = fn(b);
  return {
    ram: firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off)),
    regs: firstRegDiff(a.regs, b.regs),
    pcEqual: a.pc === b.pc,
    spEqual: a.regs.sp === b.regs.sp,
    retEqual: ra === rb,
    a, b,
  };
}

test("EQUAL (unit): idiomatic sub_33a1 matches translated in RAM + full register file + pc", () => {
  // Sanity: the natural first entry is the normal-ret arm (BOARD==1, (ix+0x0f) >= 0x59).
  assert.equal(NATURAL_ENTRY.mem.read8(BOARD), 1, "natural entry should be on BOARD==1 (25m)");
  assert.ok(NATURAL_ENTRY.mem.read8((NATURAL_ENTRY.regs.ix + 0x0f) & 0xffff) >= 0x59,
    "natural entry should be the normal-ret arm ((ix+0x0f) >= 0x59)");
  const r = runBoth(NATURAL_ENTRY, optimized_33a1);
  assert.equal(r.ram, null, r.ram ? `RAM diff at 0x${(r.ram.addr ?? 0).toString(16)}` : "");
  assert.equal(r.regs, null, r.regs ? `reg diff at ${r.regs.reg}` : "");
  assert.ok(r.pcEqual, "pc must match");
  assert.ok(r.spEqual, "SP must match");
  assert.ok(r.retEqual, "returned skip-boolean must match");
  console.log("  EQUAL/unit: RAM + all registers (incl. F, SP) + pc + ret identical (natural normal-ret entry)");
});

test("TEETH (unit behavioural): inverting the threshold is CAUGHT on the natural entry", () => {
  // The natural entry takes the normal-ret arm ((ix+0x0f) >= 0x59 -> `ret nc`). A twin
  // that tests `fC` instead of `fNC` SPLICES on this arm -> it returns to the caller's
  // CALLER (SENTINEL) with SP two frames higher, so pc + SP diverge from the oracle.
  const broken_invert = (m) => {
    const { regs, mem } = m;
    const R = (d) => (regs.ix + d) & 0xffff;
    regs.a = 0x07;
    m.step(0x33a3, 7);
    m.push16(0x33a4);
    m.step(0x0030, 11);
    if (!m.call(0x0030)) return true;
    regs.a = mem.read8(R(0x0f));
    regs.cp(0x59);
    m.step(0x33a9, 26);
    if (regs.fC) { m.ret(11); return true; } // BUG: oracle is `ret nc` (fNC)
    regs.sp = (regs.sp + 1) & 0xffff;
    regs.sp = (regs.sp + 1) & 0xffff;
    m.step(0x33ac, 17);
    m.ret();
    return false;
  };
  const r = runBoth(NATURAL_ENTRY, broken_invert);
  const caught = r.ram != null || r.regs != null || !r.pcEqual || !r.spEqual || !r.retEqual;
  assert.ok(caught, "unit gate FAILED to catch an inverted threshold -- it is worthless");
  console.log(`  TEETH/unit: caught -- ${!r.pcEqual ? "pc" : !r.spEqual ? "SP" : !r.retEqual ? "ret" : r.regs ? r.regs.reg : "ram"} diverged`);
});

// -- FULL-BRANCH COVERAGE (crafted identical-both-sides entries: ALL THREE arms) --

/**
 * Fresh machine seeded so `rst 0x30` (-> the oracle sub_0030, resolved through the
 * registry) and the threshold see the requested BOARD + (ix+0x0f), with a two-frame
 * stack: sub_33a1's OWN return (RET_ADDR) on top, the caller's CALLER (SENTINEL) below
 * it. The SENTINEL survives arms 1 & 2 and is the landing frame for the splice arm.
 * IX is work RAM so (ix+0x0f) reads/diffs real, deterministic memory.
 *   - board = 4          -> gate-fired arm (0x07's selected bit CLEAR), field ignored
 *   - board = 1, >= 0x59 -> normal-ret arm (`ret nc` to RET_ADDR)
 *   - board = 1, <  0x59 -> splice arm (inc sp; inc sp; ret to SENTINEL)
 */
function seed({ board, field }) {
  const m = new Machine(ROM);
  m.regs.sp = 0x6c00;
  m.push16(SENTINEL);  // caller's CALLER -- only the splice arm pops this
  m.push16(RET_ADDR);  // sub_33a1's own return frame (into entry_333d)
  const entrySP = m.regs.sp; // points at RET_ADDR
  m.regs.ix = IX;
  m.mem.write8(BOARD, board);
  m.mem.write8(FIELD, field);
  return { m, entrySP };
}

/** Prove one arm EQUAL (RAM + full register file + pc + SP + returned boolean) AND pin
 *  its exact cycle total: optimized == oracle, and (regression guard) the oracle total
 *  == the structural constant `expectCycles`. `expectPc`/`expectRet` document the arm. */
function assertArm(label, seedArgs, { expectCycles, expectPc, expectRet }) {
  const a = seed(seedArgs);
  const b = seed(seedArgs);
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  const ra = translated_33a1(a.m);
  const rb = optimized_33a1(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;

  const ram = firstStateDiff(a.m.dumpState(), b.m.dumpState(), (off) => a.m.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `${label}: RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(a.m.regs, b.m.regs);
  assert.equal(regs, null, regs ? `${label}: reg diff at ${regs.reg}` : "");
  assert.equal(a.m.pc, b.m.pc, `${label}: pc must match`);
  assert.equal(a.m.regs.sp, b.m.regs.sp, `${label}: SP must match`);
  assert.equal(ra, rb, `${label}: returned skip-boolean must match (oracle ${ra} vs optimized ${rb})`);
  assert.equal(dB, dA, `${label}: cycle total mismatch (oracle ${dA} t vs optimized ${dB} t)`);
  assert.equal(dA, expectCycles, `${label}: oracle total should be ${expectCycles} t (got ${dA})`);
  // The arm's structural outcome (which frame it returned to, and the balanced SP).
  assert.equal(b.m.pc, expectPc, `${label}: must land at 0x${expectPc.toString(16)}`);
  assert.equal(rb, expectRet, `${label}: skip-boolean must be ${expectRet}`);
  console.log(`  BRANCH/${label}: EQUAL -- ret=${rb} pc=0x${b.m.pc.toString(16)} ` +
    `sp=0x${b.m.regs.sp.toString(16)} (+${b.m.regs.sp - b.entrySP}) ${dB} t == oracle ${dA} t`);
}

test("BRANCH (unit): gate-fired arm -- BOARD=4 selects a CLEAR bit -> rst unwinds (returns TRUE)", () => {
  // sub_0030 pops its rst frame AND sub_33a1's return frame, landing at RET_ADDR; SP +2.
  assertArm("gate-fired", { board: 0x04, field: 0x00 },
    { expectCycles: 135, expectPc: RET_ADDR, expectRet: true });
});

test("BRANCH (unit): normal-ret arm -- BOARD=1, (ix+0x0f)=0x60 >= 0x59 -> `ret nc` (returns TRUE)", () => {
  assertArm("normal-ret", { board: 0x01, field: 0x60 },
    { expectCycles: 107, expectPc: RET_ADDR, expectRet: true });
});

test("BRANCH (unit): STACK-SPLICE arm -- BOARD=1, (ix+0x0f)=0x40 < 0x59 -> skip caller (returns FALSE)", () => {
  // THE critical arm: `inc sp; inc sp; ret` discards RET_ADDR so control lands at
  // SENTINEL (the caller's CALLER); SP +4. The collapse reorders both inc-sp ahead of
  // the lumped step -- EQUAL here (SP + stack bytes + pc) proves that reorder is safe.
  const s = seed({ board: 0x01, field: 0x40 });
  translated_33a1(s.m);
  assert.equal(s.m.pc, SENTINEL, "oracle splice must land at the caller's CALLER (SENTINEL)");
  assert.equal(s.m.regs.sp, s.entrySP + 4, "oracle splice must skip RET_ADDR (SP +4)");
  assertArm("splice", { board: 0x01, field: 0x40 },
    { expectCycles: 123, expectPc: SENTINEL, expectRet: false });
});

test("BRANCH (unit): boundary -- (ix+0x0f) == 0x59 is `ret nc` NORMAL (the unsigned test)", () => {
  // `cp 0x59` clears carry at exactly 0x59, so `ret nc` fires -> normal-ret, NOT splice.
  assertArm("boundary-0x59", { board: 0x01, field: 0x59 },
    { expectCycles: 107, expectPc: RET_ADDR, expectRet: true });
});

// -- BRANCH TEETH -------------------------------------------------------------

test("BRANCH-TEETH (behavioural): a twin that does NOT splice (< 0x59) is CAUGHT", () => {
  // The splice seed (field=0x40) must skip RET_ADDR to SENTINEL. A twin that omits the
  // two `inc sp` (a plain ret) returns to RET_ADDR instead -> pc + SP + ret all diverge.
  const broken_noSplice = (m) => {
    const { regs, mem } = m;
    const R = (d) => (regs.ix + d) & 0xffff;
    regs.a = 0x07;
    m.step(0x33a3, 7);
    m.push16(0x33a4);
    m.step(0x0030, 11);
    if (!m.call(0x0030)) return true;
    regs.a = mem.read8(R(0x0f));
    regs.cp(0x59);
    m.step(0x33a9, 26);
    if (regs.fNC) { m.ret(11); return true; }
    // BUG: the `inc sp; inc sp` STACK SPLICE is missing -- this rets to RET_ADDR.
    m.step(0x33ac, 17);
    m.ret();
    return false;
  };
  const a = seed({ board: 0x01, field: 0x40 });
  const b = seed({ board: 0x01, field: 0x40 });
  const ra = translated_33a1(a.m);
  const rb = broken_noSplice(b.m);
  const diverged = a.m.pc !== b.m.pc || a.m.regs.sp !== b.m.regs.sp ||
    firstStateDiff(a.m.dumpState(), b.m.dumpState(), (o) => a.m.stateOffsetToAddr(o)) != null;
  assert.ok(diverged, "gate FAILED to catch a missing stack splice -- it is worthless");
  assert.equal(a.m.pc, SENTINEL, "oracle splice lands at SENTINEL");
  assert.equal(b.m.pc, RET_ADDR, "no-splice twin wrongly lands at RET_ADDR");
  console.log(`  BRANCH-TEETH/behavioural: caught -- oracle pc=0x${a.m.pc.toString(16)} (ret ${ra}) vs no-splice twin pc=0x${b.m.pc.toString(16)} (ret ${rb})`);
});

test("BRANCH-TEETH (cycles): a dropped charge on the splice arm yields a wrong total and is CAUGHT", () => {
  const dropped = (m) => {
    const { regs, mem } = m;
    const R = (d) => (regs.ix + d) & 0xffff;
    regs.a = 0x07;
    m.step(0x33a3, 7);
    m.push16(0x33a4);
    m.step(0x0030, 11);
    if (!m.call(0x0030)) return true;
    regs.a = mem.read8(R(0x0f));
    regs.cp(0x59);
    m.step(0x33a9, 26);
    if (regs.fNC) { m.ret(11); return true; }
    regs.sp = (regs.sp + 1) & 0xffff;
    regs.sp = (regs.sp + 1) & 0xffff;
    m.step(0x33ac, 12); // DROPPED: correct splice block total is 17 t
    m.ret();
    return false;
  };
  const a = seed({ board: 0x01, field: 0x40 });
  const b = seed({ board: 0x01, field: 0x40 });
  const ca0 = a.m.cycles, cb0 = b.m.cycles;
  translated_33a1(a.m);
  dropped(b.m);
  const dA = a.m.cycles - ca0, dB = b.m.cycles - cb0;
  assert.notEqual(dB, dA, "cycle-total assertion has no teeth");
  console.log(`  BRANCH-TEETH/cycles: oracle ${dA} t vs dropped-charge ${dB} t -- caught`);
});
