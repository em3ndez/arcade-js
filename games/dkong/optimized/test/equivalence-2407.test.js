// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence tests for sub_2407 -- FIXED-POINT SUBTRACT: spread packed byte
 * (ix+0x14)=0xHL into HL=(H<<8)|(L<<4), then HL -= BC where BC=(ix+0x12:0x13).
 * Returns HL in the register file; writes NO memory. See optimized/sub_2407.js.
 *
 * SHAPE. sub_2407 is a pure arithmetic LEAF: no call, no memory write, and -- the
 * point for coverage -- NO data-dependent branch. It has exactly ONE control-flow
 * arm (straight-line body + ret), so "cover every arm" is that single path, driven
 * here across several crafted operand sets (including a subtract that borrows and
 * sets the exit carry) to prove the nibble-spread + sbc transform is general, not
 * entry-specific. (There is no stack-splice / SP-mutating arm here -- that caveat is
 * specific to 0x33a1; sub_2407 never touches SP beyond its own ret.)
 *
 * GATE: STRICT WHOLE-MACHINE (byte-exact), driven from real captured dispatch state
 * -- plus a unit crafted-entry sweep. MEASURED reachability + atomicity: 12 dispatches
 * over a 1200-frame ATTRACT run, io.nmiMask == 0 at 100% of them (probed) -- sub_2407
 * runs mask-cleared inside the vblank-NMI loc_197a object-physics cascade, so a second
 * NMI cannot land inside it and no coarse PC is ever pushed into its span. An atomic
 * byte-exact collapse passes the ORDINARY strict gate (docs/06 -- the CONVERGENT gate
 * is only for INTERRUPTIBLE collapses).
 *
 * TEETH NOTE. Because sub_2407 writes no memory, a wrong result is NOT a RAM diff of
 * the routine itself -- it lives in the RETURNED registers (H/L). The unit value-teeth
 * therefore fire on the register diff. The whole-machine teeth still surface as RAM
 * drift once a caller (loc_1bd8 stores H/L back into the object record) writes the bad
 * value: a flipped H bit forks the record at 0x6733 by frame 966 (probed).
 *
 * Jobs:
 *   1. EQUAL (whole-machine, strict) -- optimized == oracle across the full per-frame
 *      RAM trace of an attract run; the override must fire (non-vacuous).
 *   2. EQUAL (unit, all operand sets) -- crafted entries prove RAM + full register file
 *      (incl. F) + pc + SP identical over the single arm, incl. a borrow case.
 *   3. CYCLES (unit) -- the exact oracle total (128 t) is charged on every operand set
 *      (explicit pin over the collapse: one straight-line block folds to m.step(118)+ret(10)).
 *   4. TEETH (value, whole-machine) -- a flipped-H twin forks the object record, CAUGHT.
 *   5. TEETH (value, unit) -- a flipped-H twin is CAUGHT by the register diff (names H).
 *   6. TEETH (cycles, unit) -- a dropped m.step charge yields a wrong total, CAUGHT.
 *
 * Run: node --test
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_2407 as translated_2407 } from "../../translated/sub_2407.js";
import { sub_2407 as optimized_2407 } from "../sub_2407.js";
import { Machine } from "../../machine.js";
import {
  wholeMachineEquivalence,
  firstStateDiff,
  firstRegDiff,
} from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built -- run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x2407;
const ORACLE_CYCLES = 128; // 118 (folded body) + 10 (ret) -- the exact oracle sum
const FRAMES = 1200; // attract; sub_2407 dispatches 12x by here (measured)

// Attract reaches sub_2407 through the loc_197a object-physics cascade -- no input tape needed.
const attractFactory = (overrides) => new Machine(ROM, overrides ? { overrides } : {});

// -- deterministic attract entry for the UNIT crafted tests --------------------
// Snapshot the live machine the first time sub_2407 is DISPATCHED: pc=0x2407, a real
// object record under IX, a valid return frame on the stack. The most faithful base
// to craft operand variations onto (only the three IX fields are overwritten).
function captureEntry() {
  let entry = null;
  const snap = new Map([[TARGET, (mm) => { if (entry === null) entry = mm.clone(); return translated_2407(mm); }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(FRAMES);
  if (entry === null) throw new Error("sub_2407 never dispatched -- cannot craft an entry");
  return entry;
}
const ENTRY = ROM_PRESENT ? captureEntry() : null;

/** Clone the captured entry and seed the routine's three inputs:
 *  packed byte (ix+0x14) and BC = (ix+0x12):(ix+0x13). Writes nothing else, so both
 *  clones read identical operands and the routine's own RAM footprint stays empty. */
function craft(packed, bcHi, bcLo) {
  const c = ENTRY.clone();
  const ix = c.regs.ix;
  c.mem.write8((ix + 0x14) & 0xffff, packed);
  c.mem.write8((ix + 0x12) & 0xffff, bcHi);
  c.mem.write8((ix + 0x13) & 0xffff, bcLo);
  return c;
}

// The single arm, swept over operand sets that exercise the whole transform:
//   name             packed  BChi BClo   -> notes
const OPERANDS = [
  { name: "zero (Z set, no borrow)", p: 0x00, bh: 0x00, bl: 0x00 },
  { name: "typical spread - BC",     p: 0x35, bh: 0x01, bl: 0x20 },
  { name: "borrow -> exit carry",    p: 0x00, bh: 0x00, bl: 0x01 }, // HL = 0 - 1 = 0xFFFF
  { name: "max nibbles, no borrow",  p: 0xff, bh: 0x00, bl: 0x00 }, // HL = 0x0FF0
  { name: "mixed, borrow",           p: 0x9c, bh: 0x0a, bl: 0x3b }, // HL = 0x0F90 - 0x0A3B ... wraps
  { name: "big borrow",              p: 0x50, bh: 0x0f, bl: 0xf0 }, // HL = 0x0500 - 0x0FF0
];

// -- 1. EQUAL (whole-machine, strict) -----------------------------------------

test("EQUAL (whole-machine strict): optimized sub_2407 matches oracle over an attract run", () => {
  const r = wholeMachineEquivalence(attractFactory, FRAMES, new Map([[TARGET, optimized_2407]]));
  const fired = r.invocations.get(TARGET);
  assert.ok(fired >= 1, `override at 0x${TARGET.toString(16)} never dispatched (invocations=${fired})`);
  assert.equal(
    r.equal,
    true,
    r.equal ? "" : `NOT equal at frame ${r.frame}, 0x${(r.addr ?? 0).toString(16)} (base ${r.baseline} vs opt ${r.optimized})`,
  );
  console.log(`  EQUAL/whole-machine: strict per-frame RAM identical over ${r.framesCompared} frames; fired ${fired}x`);
});

// -- 2. EQUAL (unit, every operand set on the single arm) ----------------------

function assertOperandEqual({ name, p, bh, bl }) {
  const o = craft(p, bh, bl); // oracle clone
  const q = craft(p, bh, bl); // optimized clone
  const oc = o.cycles, qc = q.cycles;
  translated_2407(o);
  optimized_2407(q);

  const ram = firstStateDiff(o.dumpState(), q.dumpState(), (off) => o.stateOffsetToAddr(off));
  assert.equal(ram, null, ram ? `RAM diff at 0x${(ram.addr ?? 0).toString(16)}` : "");
  const regs = firstRegDiff(o.regs, q.regs);
  assert.equal(regs, null, regs ? `reg diff at ${regs.reg} (oracle 0x${(regs?.a ?? 0).toString(16)} vs opt 0x${(regs?.b ?? 0).toString(16)})` : "");
  assert.equal(o.pc, q.pc, "pc must match");
  assert.equal(o.regs.sp, q.regs.sp, "SP must match (ret balance; no stack splice on this leaf)");

  // Independent check that the returned HL is the documented spread - BC (not just
  // "optimized == oracle"): H<<8 | L<<4 for the packed nibbles, minus BC, mod 0x10000.
  const expHL = (((p >> 4) << 8) | ((p & 0x0f) << 4)) - ((bh << 8) | bl);
  assert.equal(q.regs.hl, expHL & 0xffff, `HL must equal spread(0x${p.toString(16)}) - BC`);

  // Collapse preserves the exact per-arm cycle total.
  assert.equal(o.cycles - oc, ORACLE_CYCLES, `oracle total should be ${ORACLE_CYCLES} t`);
  assert.equal(q.cycles - qc, o.cycles - oc, "collapsed cycle total must match the oracle");
  console.log(`  EQUAL/unit [${name}]: HL=0x${q.regs.hl.toString(16)}, F=0x${q.regs.f.toString(16)} -- RAM + regs + pc + SP + cycles identical`);
}

for (const op of OPERANDS) {
  test(`EQUAL (unit): single arm -- ${op.name}`, () => assertOperandEqual(op));
}

// -- 3. CYCLES (explicit total pin, single path) ------------------------------

test("CYCLES: sub_2407 charges the exact oracle total (128 t)", () => {
  const o = craft(0x35, 0x01, 0x20);
  const q = craft(0x35, 0x01, 0x20);
  const oc = o.cycles, qc = q.cycles;
  translated_2407(o);
  optimized_2407(q);
  const dO = o.cycles - oc, dQ = q.cycles - qc;
  assert.equal(dO, ORACLE_CYCLES, `oracle total should be ${ORACLE_CYCLES} t`);
  assert.equal(dQ, dO, `cycle total mismatch (oracle ${dO} t vs collapsed ${dQ} t)`);
  console.log(`  CYCLES: oracle ${dO} t == collapsed ${dQ} t`);
});

// -- 4. TEETH (value, whole-machine) ------------------------------------------

/** Behaves like optimized, then flips the low bit of H. H is a nibble (0x0..0xF), so the
 *  flip always changes HL; the caller stores H/L back into the object record, forking it. */
function brokenValue(m) {
  const rv = optimized_2407(m);
  m.regs.h = m.regs.h ^ 0x01;
  m.regs.hl = ((m.regs.h << 8) | m.regs.l) & 0xffff;
  return rv;
}

test("TEETH (value, whole-machine): a flipped-H result forks the object record and is CAUGHT", () => {
  const r = wholeMachineEquivalence(attractFactory, FRAMES, new Map([[TARGET, brokenValue]]));
  assert.equal(r.equal, false, "strict gate FAILED to catch a corrupted sub_2407 result");
  console.log(`  TEETH/value: caught at frame ${r.frame}, 0x${(r.addr ?? 0).toString(16)} (base ${r.baseline} vs broken ${r.optimized})`);
});

// -- 5. TEETH (value, unit) ---------------------------------------------------

test("TEETH (value, unit): a flipped-H result is CAUGHT and names H", () => {
  const o = craft(0x35, 0x01, 0x20);
  const b = craft(0x35, 0x01, 0x20);
  translated_2407(o);
  brokenValue(b);
  // sub_2407 writes no memory, so the fault is in the RETURNED registers, not RAM.
  const ram = firstStateDiff(o.dumpState(), b.dumpState(), (off) => o.stateOffsetToAddr(off));
  assert.equal(ram, null, "sub_2407 writes no memory -- there should be no RAM diff to find");
  const regs = firstRegDiff(o.regs, b.regs);
  assert.ok(regs != null, "unit gate FAILED to catch a wrong result -- it is worthless");
  assert.equal(regs.reg, "h", `expected first reg diff at H, got ${regs.reg}`);
  console.log(`  TEETH/value/unit: caught at reg ${regs.reg} (oracle 0x${regs.a.toString(16)} vs broken 0x${regs.b.toString(16)})`);
});

// -- 6. TEETH (cycles) --------------------------------------------------------

/** Same behaviour as optimized, but the folded body charge is 5 t short, so the path
 *  total no longer matches the oracle (128 -> 123). Deterministic teeth for the pin. */
function cyclebroken(m) {
  const { regs, mem } = m;
  const ix = regs.ix;
  const packed = mem.read8((ix + 0x14) & 0xffff);
  regs.h = packed >> 4;
  regs.a = (packed << 4) & 0xf0;
  regs.l = regs.a;
  regs.c = mem.read8((ix + 0x13) & 0xffff);
  regs.b = mem.read8((ix + 0x12) & 0xffff);
  regs.and(regs.a);
  regs.sbcHl(regs.bc);
  m.step(0x241e, 113); // DROPPED: the correct folded body charge is 118 t
  m.ret(10);
}

test("TEETH (cycles, unit): a dropped m.step charge yields a wrong total and is CAUGHT", () => {
  const good = craft(0x35, 0x01, 0x20);
  const bad = craft(0x35, 0x01, 0x20);
  const gc = good.cycles, bc = bad.cycles;
  optimized_2407(good);
  cyclebroken(bad);
  assert.equal(good.cycles - gc, ORACLE_CYCLES, `the correct total is ${ORACLE_CYCLES} t`);
  assert.notEqual(bad.cycles - bc, good.cycles - gc, "cycle-total assertion has no teeth");
  console.log(`  TEETH/cycles/unit: correct ${good.cycles - gc} t vs dropped-charge ${bad.cycles - bc} t -- caught`);
});
