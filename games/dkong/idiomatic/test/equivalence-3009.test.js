// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_3009 (ROM 0x3009) — the packed 4x2-bit-field lookup.
 *
 * entry_3009 is a LEAF and a PURE function of its two register-byte inputs
 * (a = A, b = B): it reads no memory, WRITES NO MEMORY, and calls nothing.
 * Register A and the CARRY flag are the live-out (0x23F7 consumes carry via
 * `rra`); b/c/d are reproduced faithfully and checked as free teeth. So it is
 * gated the strongest way a leaf can be — EXHAUSTIVELY against the frozen oracle
 * — not by a whole-machine trace:
 *
 *   1. UNWIRED, so no captured dispatches. 0x3009 is absent from the dispatch
 *      registry (its three call sites 0x1C9E/0x1CBA/0x23F4 are the untranslated
 *      1977 subtree), so attract never dispatches it. Test #0 PROVES this by
 *      hooking 0x3009 over a real attract run and asserting zero entries — which
 *      is why the gate is exhaustive-crafted rather than capture-based.
 *
 *   2. EQUAL (exhaustive) — loc_3009 == oracle over the full 65,536 (a,b) grid,
 *      on {A, carry, b, c, d}. The routine has FAITHFUL NON-TERMINATION (the
 *      field-scan loop hangs when no 2-bit field of C equals the selector), so an
 *      INDEPENDENT predicate `willTerminate` skips the hanging inputs; the oracle
 *      is only ever run where it is guaranteed to return.
 *
 *   3. PURITY — the oracle writes NO RAM on a spread of crafted entry states,
 *      which is what licenses the memory-free pure signature.
 *
 *   4. ARMS — each of the three exit arms (next!=3 / next==3&d!=0 / next==3&d==0)
 *      is shown reached and matching, so the exhaustive PASS is not vacuous on
 *      any arm.
 *
 *   5. TEETH (exhaustive) — a twin with a plausible off-by-one in the exit
 *      threshold (`next != 2` instead of `!= 3`) MUST be caught by the sweep. It
 *      leaves the loop untouched (so it never hangs) and agrees with the oracle
 *      on every input whose exit field is 0 or 1, so only a real scan catches it.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-3009.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { entry_3009 as oracle } from "../../translated/entry_3009.js";
import { loc_3009 } from "../loc_3009.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x3009;
const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * Run the frozen oracle for one (a,b) and read back the register file at `ret`.
 *
 * The machine is REUSED across combos: the oracle writes NO memory (test #3
 * proves it), so nothing accumulates. It is a clone() so its frame machinery is
 * neutralised (nextNmi / nextBoundary = Infinity) and an m.step during the call
 * cannot trip a boundary/NMI. SP is reset into work RAM each call so the trailing
 * `ret`'s stack pop reads valid bytes and never drifts into I/O space. The
 * routine's inputs are only A and B, so overwriting them each call is a clean
 * reset. NEVER call this on a non-terminating (a,b): the oracle would hang.
 */
function runOracle(m, a, b) {
  const { regs } = m;
  regs.a = a & 0xff;
  regs.b = b & 0xff;
  regs.sp = 0x6bfe;
  oracle(m);
  return { a: regs.a & 0xff, carry: (regs.f & 0x01) !== 0, b: regs.b & 0xff, c: regs.c & 0xff, d: regs.d & 0xff };
}

/**
 * INDEPENDENT termination predicate — deliberately NOT sharing code with
 * loc_3009, so a bug in loc_3009 cannot mask itself here. It reproduces only the
 * front-half (which C is selected and whether B is decremented) and checks
 * whether the selector appears among C's four 2-bit fields. The scan rotates C
 * by 2 with period 4, so it visits exactly those four fields; membership is the
 * exact terminating condition.
 */
function willTerminate(a, b) {
  const pathBitSet = (a & 0x01) !== 0;
  let bEff = b & 0xff;
  let c;
  if (!pathBitSet) {
    c = (a & 0x04) ? 0x6c : 0x90;
  } else {
    c = (a & 0x04) ? 0x1e : 0xb4;
    if (b & 0x04) bEff = (b - 1) & 0xff;
  }
  const fields = [c & 3, (c >> 2) & 3, (c >> 4) & 3, (c >> 6) & 3];
  return fields.includes(bEff);
}

// -- 0. UNWIRED: attract never dispatches 0x3009 ------------------------------

test("UNWIRED: hooking 0x3009 over a real attract run captures ZERO dispatches", () => {
  let entries = 0;
  const hook = new Map([[TARGET, (mm) => { entries++; return oracle(mm); }]]);
  const host = new Machine(ROM, { overrides: hook });
  host.runFrames(600);
  assert.equal(entries, 0, "0x3009 was dispatched during attract — it is no longer unwired; add real captures");
  console.log("  UNWIRED: 0 dispatches of 0x3009 in 600 attract frames — exhaustive-crafted gate is the right one");
});

// -- 1. sanity: the known hang is excluded ------------------------------------

test("SANITY: the known-hang input (a=0x00,b=0x03) is flagged non-terminating", () => {
  // a=0 -> path bit0 clear, bit2 clear -> C = 0x90 (fields {0,0,1,2}, no 3);
  // bEff = b = 3 -> never matched -> the ROM loops forever, so we must skip it.
  assert.equal(willTerminate(0x00, 0x03), false, "willTerminate must exclude the C=0x90/bEff=3 hang");
  assert.equal(willTerminate(0x00, 0x00), true, "C=0x90 does contain field 0");
});

// -- 2. EQUAL (exhaustive over the terminating domain) ------------------------

test("EQUAL (exhaustive): loc_3009 == oracle on {A,carry,b,c,d} over all terminating (a,b)", () => {
  const m = new Machine(ROM).clone();
  let ran = 0, skipped = 0;
  let mismatch = null;
  for (let a = 0; a < 256 && !mismatch; a++) {
    for (let b = 0; b < 256; b++) {
      if (!willTerminate(a, b)) { skipped++; continue; }
      const want = runOracle(m, a, b);
      const got = loc_3009(a, b);
      ran++;
      if (got.a !== want.a || got.carry !== want.carry || got.b !== want.b || got.c !== want.c || got.d !== want.d) {
        mismatch = { a, b, want, got };
        break;
      }
    }
  }
  assert.equal(
    mismatch,
    null,
    mismatch &&
      `mismatch at a=${hx(mismatch.a)} b=${hx(mismatch.b)}: oracle=${JSON.stringify(mismatch.want)} loc=${JSON.stringify(mismatch.got)}`,
  );
  assert.equal(ran + skipped, 256 * 256, "must have visited the full 65,536-combo grid");
  assert.ok(ran > 1000, `expected a large terminating set, ran only ${ran}`);
  console.log(`  EQUAL/exhaustive: ${ran} terminating combos identical to the oracle (${skipped} non-terminating skipped)`);
});

// -- 3. PURITY: the oracle writes no RAM --------------------------------------

test("PURITY: the oracle mutates NO RAM on crafted entry states — licenses the pure signature", () => {
  const base = new Machine(ROM).clone();
  const samples = [[0x00, 0x00], [0x01, 0x01], [0x03, 0x01], [0x02, 0x02], [0xff, 0x00], [0x55, 0x02], [0xaa, 0x01]];
  for (const [a, b] of samples) {
    assert.ok(willTerminate(a, b), `sample (${hx(a)},${hx(b)}) must terminate to be safe to run`);
    const oc = base.clone();
    oc.regs.a = a; oc.regs.b = b; oc.regs.sp = 0x6bfe;
    const before = oc.dumpState();
    oracle(oc);
    const after = oc.dumpState();
    const d = firstStateDiff(before, after, (off) => oc.stateOffsetToAddr(off));
    assert.equal(
      d,
      null,
      d && `oracle wrote RAM at 0x${(d.addr ?? 0).toString(16)} (${d.a}->${d.b}) on (${hx(a)},${hx(b)}) — signature is not pure`,
    );
  }
  console.log(`  PURITY: ${samples.length} crafted dispatches — oracle wrote no RAM`);
});

// -- 4. ARMS: every exit arm is reached and matches ---------------------------

test("ARMS: each exit arm (next!=3, next==3 & d!=0, next==3 & d==0) is hit and matches the oracle", () => {
  const m = new Machine(ROM).clone();
  // (2,0): early arm next!=3 -> A=1 carry set;  (3,1): deep, d!=0 -> A=3 carry clear;
  // (1,1): deep, d==0 -> A=4 carry clear.
  const arms = {
    "next!=3":        [0x02, 0x00],
    "next==3, d!=0":  [0x03, 0x01],
    "next==3, d==0":  [0x01, 0x01],
  };
  for (const [label, [a, b]] of Object.entries(arms)) {
    const want = runOracle(m, a, b);
    const got = loc_3009(a, b);
    assert.deepEqual(got, { a: want.a, carry: want.carry, b: want.b, c: want.c, d: want.d }, `arm "${label}" mismatch`);
  }
  // Confirm the arms are actually distinct (guards against all three collapsing).
  assert.equal(loc_3009(0x02, 0x00).carry, true, "early arm should set carry");
  assert.equal(loc_3009(0x03, 0x01).a, 3, "deep d!=0 arm returns A=3");
  assert.equal(loc_3009(0x01, 0x01).a, 0x04, "deep d==0 arm returns A=0x04");
  console.log("  ARMS: all three exit arms reached, distinct, and equal to the oracle");
});

// -- 5. TEETH (exhaustive) ----------------------------------------------------

/**
 * Broken twin: an off-by-one in the exit threshold — tests `next != 2` where the
 * routine tests `next != 3`. The scan loop is byte-identical (so it NEVER hangs
 * where the real one terminates) and it agrees with the oracle on every input
 * whose exit field is 0 or 1, so only the real sweep — reaching a next in {2,3}
 * — catches it.
 */
function brokenLoc3009(a, b) {
  const ror2 = (v) => ((v >> 2) | (v << 6)) & 0xff;
  const d = a;
  let bEff = b;
  let c;
  if ((a & 0x01) === 0) {
    c = (a & 0x04) ? 0x6c : 0x90;
  } else {
    c = (a & 0x04) ? 0x1e : 0xb4;
    if (b & 0x04) bEff = (b - 1) & 0xff;
  }
  for (;;) {
    c = ror2(c);
    if ((c & 0x03) === bEff) break;
  }
  const next = ror2(c) & 0x03;
  if (next !== 2) return { a: next, carry: true, b: bEff, c, d }; // BUG: 2 should be 3
  const d2 = ((d & ~0x04) - 1) & 0xff;
  if (d2 !== 0) return { a: 3, carry: false, b: bEff, c, d: d2 };
  return { a: 0x04, carry: false, b: bEff, c, d: d2 };
}

test("TEETH (exhaustive): the exit-threshold twin is CAUGHT by the sweep", () => {
  const m = new Machine(ROM).clone();
  let caught = null;
  for (let a = 0; a < 256 && !caught; a++) {
    for (let b = 0; b < 256; b++) {
      if (!willTerminate(a, b)) continue;
      const want = runOracle(m, a, b);
      const got = brokenLoc3009(a, b);
      if (got.a !== want.a || got.carry !== want.carry || got.b !== want.b || got.c !== want.c || got.d !== want.d) {
        caught = { a, b, want, got };
        break;
      }
    }
  }
  assert.notEqual(caught, null, "the exhaustive sweep FAILED to catch the exit-threshold twin — it is worthless");
  console.log(`  TEETH/exhaustive: twin caught at a=${hx(caught.a)} b=${hx(caught.b)} (oracle A=${hx(caught.want.a)} carry=${caught.want.carry}, twin A=${hx(caught.got.a)} carry=${caught.got.carry})`);
});
