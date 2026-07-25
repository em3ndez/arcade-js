// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for stirRandomSeed (ROM 0x0057) — the once-per-vblank PRNG stir.
 *
 * sub_0057 is a branch-free leaf: its observable output is a total function of the
 * three RAM bytes it reads — RANDOM (0x6018), FRAME (0x601A), SPIN_COUNT (0x6019) —
 * producing RANDOM = (RANDOM + FRAME + SPIN_COUNT) & 0xff, plus two live-out
 * registers (A = the fresh seed, HL = 0x6019). It writes exactly one byte and calls
 * nothing, so it is gated against the frozen oracle four ways:
 *
 *   1. EQUAL (grid) — stirRandomSeed's (RANDOM-write, A, HL) == oracle's over the
 *      full 256×256 (seed,frame) grid at a boundary set of SPIN_COUNT values. This
 *      exercises every 8-bit-sum wraparound of the two swept terms.
 *
 *   2. EQUAL (spin breadth) — sweep ALL 256 SPIN_COUNT bytes over curated
 *      (seed,frame) edges, proving the third addend wraps identically too.
 *
 *   3. TEETH — a deliberately-broken twin that DROPS the FRAME term
 *      (seed = (RANDOM + SPIN_COUNT) & 0xff) MUST be caught by the same sweeps.
 *
 *   4. REALISM + MEMORY-EQUIVALENCE (captured dispatches) — hook 0x0057 in a real
 *      attract run and clone the machine at each true vblank invocation; for each,
 *      run the oracle and stirRandomSeed on independent FRESH clones and diff RAM
 *      (dumpState — work+sprite+video, which excludes pc/SP) + A + HL. Also confirm
 *      the oracle's memory footprint is exactly RANDOM (nothing else, stack untouched).
 *
 * WHY NOT pc/SP: the idiomatic leaf models the Z80 `ret` as the JS return (doc-06),
 * so it deliberately leaves pc/SP at their entry values while the oracle's `ret`
 * advances them. Comparing pc/SP would measure the absent ret, not the routine's
 * logic. RAM + A + HL is the routine's real contract.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-0057.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { sub_0057 as oracle } from "../../translated/sub_0057.js";
import { stirRandomSeed } from "../stirRandomSeed.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { RANDOM, FRAME, SPIN_COUNT } from "../../optimized/ram.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x0057;
const hx = (v) => "0x" + (v & 0xff).toString(16).padStart(2, "0");

/**
 * Set the three input bytes + a valid SP, run `fn` (oracle or idiomatic), and read
 * back the routine's observable outputs. The machine is REUSED across the sweep: we
 * fully overwrite all three input bytes each call and the routine's only memory
 * write (RANDOM) is one of them, so nothing accumulates. SP is reset into work RAM
 * so the oracle's trailing `ret` pops valid bytes (it reads them, never writes).
 */
function run(m, fn, seed, frame, spin) {
  const { regs, mem } = m;
  mem.write8(RANDOM, seed);
  mem.write8(FRAME, frame);
  mem.write8(SPIN_COUNT, spin);
  regs.sp = 0x6bfe;
  fn(m);
  return { out: mem.read8(RANDOM), a: regs.a & 0xff, hl: regs.hl & 0xffff };
}

/**
 * Compare a candidate against the oracle over the full 256×256 (seed,frame) grid for
 * each spin in `spins`. Returns the first mismatch (or null) and the combo count.
 */
function sweep(candidate, spins) {
  const mo = new Machine(ROM).clone();
  const mc = new Machine(ROM).clone();
  let count = 0;
  for (const spin of spins) {
    for (let seed = 0; seed < 256; seed++) {
      for (let frame = 0; frame < 256; frame++) {
        const want = run(mo, oracle, seed, frame, spin);
        const got = run(mc, candidate, seed, frame, spin);
        count++;
        if (got.out !== want.out || got.a !== want.a || got.hl !== want.hl) {
          return { mismatch: { seed, frame, spin, want, got }, count };
        }
      }
    }
  }
  return { mismatch: null, count };
}

const fmt = (m) =>
  `seed=${hx(m.seed)} frame=${hx(m.frame)} spin=${hx(m.spin)}: ` +
  `oracle{out=${hx(m.want.out)} a=${hx(m.want.a)} hl=0x${m.want.hl.toString(16)}} ` +
  `cand{out=${hx(m.got.out)} a=${hx(m.got.a)} hl=0x${m.got.hl.toString(16)}}`;

// -- 1. EQUAL (grid) ----------------------------------------------------------

test("EQUAL (grid): stirRandomSeed == oracle over the full seed×frame grid at boundary spins", () => {
  // Boundary SPIN_COUNT values: the carry edges of the third addend.
  const SPINS = [0x00, 0x01, 0x0f, 0x10, 0x7f, 0x80, 0x81, 0xff];
  const { mismatch, count } = sweep(stirRandomSeed, SPINS);
  assert.equal(mismatch, null, mismatch && fmt(mismatch));
  assert.equal(count, 256 * 256 * 8, "must have compared the full grid at every boundary spin");
  console.log(`  EQUAL/grid: ${count} (seed,frame,spin) combos identical (out + A + HL)`);
});

// -- 2. EQUAL (spin breadth) --------------------------------------------------

test("EQUAL (spin breadth): all 256 spin bytes match the oracle on curated seed/frame edges", () => {
  const EDGES = [0x00, 0x01, 0x0f, 0x10, 0x7f, 0x80, 0x81, 0xfe, 0xff];
  const mo = new Machine(ROM).clone();
  const mc = new Machine(ROM).clone();
  let count = 0;
  let mismatch = null;
  for (let spin = 0; spin < 256 && !mismatch; spin++) {
    for (const seed of EDGES) {
      for (const frame of EDGES) {
        const want = run(mo, oracle, seed, frame, spin);
        const got = run(mc, stirRandomSeed, seed, frame, spin);
        count++;
        if (got.out !== want.out || got.a !== want.a || got.hl !== want.hl) {
          mismatch = { seed, frame, spin, want, got };
          break;
        }
      }
      if (mismatch) break;
    }
  }
  assert.equal(mismatch, null, mismatch && fmt(mismatch));
  console.log(`  EQUAL/spin-breadth: ${count} combos over all 256 spin values identical`);
});

// -- 3. TEETH -----------------------------------------------------------------

/**
 * Broken twin: DROPS the FRAME term. Agrees with the oracle whenever FRAME == 0,
 * so only a real sweep across nonzero FRAME catches it.
 */
function brokenStir(m) {
  const { regs, mem } = m;
  const seed = (mem.read8(RANDOM) + mem.read8(SPIN_COUNT)) & 0xff; // BUG: FRAME omitted
  mem.write8(RANDOM, seed);
  regs.a = seed;
  regs.hl = SPIN_COUNT;
}

test("TEETH: the FRAME-dropping twin is CAUGHT by the sweep", () => {
  const { mismatch, count } = sweep(brokenStir, [0x00, 0x01, 0x0f, 0x10, 0x7f, 0x80, 0x81, 0xff]);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a dropped FRAME term — it is worthless");
  console.log(`  TEETH: caught after ${count} combos at ${fmt(mismatch)}`);
});

// -- 4. REALISM + MEMORY-EQUIVALENCE (captured dispatches) --------------------

/**
 * Hook 0x0057 in a real attract run and clone the machine at up to K real
 * dispatches. sub_0057 fires every vblank from the NMI (ROM 0x00B9), so a short
 * run yields many. The wrapper clones the entry state, then runs the oracle so the
 * host game proceeds undisturbed.
 */
function captureDispatches(K, maxFrames) {
  const caps = [];
  const snapshot = new Map([[TARGET, (mm) => {
    if (caps.length < K) caps.push(mm.clone());
    return oracle(mm);
  }]]);
  const host = new Machine(ROM, { overrides: snapshot });
  host.runFrames(maxFrames);
  return caps;
}

test("REALISM + MEMORY-EQUIVALENCE: real captured vblank dispatches — RAM + A + HL match, footprint = RANDOM only", () => {
  const caps = captureDispatches(64, 200);
  assert.ok(caps.length >= 1, "expected at least one real 0x0057 dispatch during attract");

  for (const cap of caps) {
    // FRESH clone per side — this routine writes memory, so snapshots are never shared.
    const a = cap.clone(); // oracle
    const b = cap.clone(); // idiomatic
    const before = a.dumpState();
    oracle(a);
    stirRandomSeed(b);

    // MEMORY-EQUIVALENCE: identical RAM (work+sprite+video excludes pc/SP; the
    // oracle's `ret` and the JS return leave RAM untouched beyond RANDOM).
    const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
    assert.equal(
      d,
      null,
      d && `RAM diverged at 0x${(d.addr ?? 0).toString(16)} (${d.a}->${d.b})`,
    );

    // LIVE-OUT registers.
    assert.equal(b.regs.a & 0xff, a.regs.a & 0xff, "A (fresh seed) diverged");
    assert.equal(b.regs.hl & 0xffff, a.regs.hl & 0xffff, "HL diverged");

    // FOOTPRINT: the oracle changed exactly RANDOM versus the captured entry, and
    // no other byte (justifies the single-write idiomatic body). Scan the whole dump.
    const after = a.dumpState();
    const changed = [];
    for (let i = 0; i < before.length; i++) {
      if (before[i] !== after[i]) changed.push(a.stateOffsetToAddr(i));
    }
    assert.ok(
      changed.length <= 1 && (changed.length === 0 || changed[0] === RANDOM),
      `oracle footprint = [${changed.map((x) => "0x" + x.toString(16)).join(",")}], expected only RANDOM`,
    );
  }
  console.log(`  REALISM: ${caps.length} real 0x0057 dispatches — RAM + A + HL == oracle, footprint = RANDOM`);
});
