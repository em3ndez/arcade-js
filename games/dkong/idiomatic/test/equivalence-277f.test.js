// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_277f (ROM 0x277F) — the vertical-mover edge reset.
 *
 * loc_277f is a LEAF with NO inputs and no branches: it always clears the same two
 * cells — MARIO_ACTIVE (0x6200) and the edge flag (0x6398) — and returns. Its whole
 * memory-observable behaviour is therefore "overwrite those two cells with 0, touch
 * nothing else," independent of every register and every other byte of RAM. The
 * oracle's terminal return only POPS the caller address (never writes), and no caller
 * consumes the cleared accumulator/flags, so the contract is memory-only and the RAM
 * diff spans the whole dump with NO STACK_SCRATCH exclusion.
 *
 * Because the output is constant, "exhaustive" means proving the overwrite is truly
 * UNCONDITIONAL — that whatever the two cells held before, they end at 0 and nothing
 * else moves:
 *
 *   SWEEP A — MARIO_ACTIVE prior over all 256 values (edge flag fixed nonzero, plus
 *             noise in both cells' neighbours). Proves the MARIO_ACTIVE clear does not
 *             depend on its prior value.
 *   SWEEP B — edge-flag prior over all 256 values (MARIO_ACTIVE fixed nonzero, noise
 *             on). Proves the edge-flag clear does not depend on its prior value, and
 *             covers the already-zero no-op.
 *
 * The routine is NOT dispatched in attract (it fires only when a mover leaves its
 * track — verified 0 dispatches over 9000 frames), so realism comes from building the
 * crafted entries on a REAL booted attract-base machine (self-consistent surrounding
 * work RAM) rather than a bare reset, and the non-vacuity checks confirm the two cells
 * actually reach 0 and the noisy neighbours are left alone.
 *
 *   1. EQUAL (exhaustive) — loc_277f == oracle on RAM across both 256-value sweeps.
 *
 *   2. NON-VACUITY — on a nonzero-prior entry, the oracle's write set is EXACTLY
 *      {MARIO_ACTIVE, edge flag}, both land at 0, and the noise neighbours are
 *      untouched — so the sweeps are comparing a real overwrite, not two no-ops.
 *
 *   3. TEETH (exhaustive) — three deliberately-broken twins, each of which the same
 *      sweeps MUST catch:
 *        (a) dropped edge-flag clear — writes only MARIO_ACTIVE; caught at 0x6398.
 *        (b) nonzero MARIO write — writes 1 instead of 0; caught at 0x6200.
 *        (c) off-by-one target — clears 0x6399 instead of 0x6398; caught at 0x6398
 *            (the oracle cleared it, the twin left the prior).
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-277f.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_277f as oracle } from "../../translated/loc_277f.js";
import { loc_277f } from "../loc_277f.js";
import { MARIO_ACTIVE } from "../../optimized/ram.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const TARGET = 0x277f;
const EDGE_FLAG = 0x6398; // cleared alongside MARIO_ACTIVE; no ram.js name yet.

// Neighbour cells seeded with noise to prove the routine touches ONLY the two targets.
const MARIO_LO = 0x61ff, MARIO_HI = 0x6201;
const EDGE_LO = 0x6397, EDGE_HI = 0x6399;
const NOISE = new Map([[MARIO_LO, 0x5a], [MARIO_HI, 0xa5], [EDGE_LO, 0x3c], [EDGE_HI, 0xc3]]);

// The oracle's terminal `ret` pops the stack; point SP at work RAM so the pop reads
// valid bytes (never I/O). The pop only READS — it writes no RAM — so this choice never
// affects the compared memory; it only keeps the oracle well-defined.
const SAFE_SP = 0x6bf8;

const hx = (v) => "0x" + (v & 0xffff).toString(16);

// A real, self-consistent machine: boot + a stretch of attract so work RAM holds
// realistic values. The edge reset is never dispatched here; it is crafted by poking.
function attractBase(frames = 180) {
  const m = new Machine(ROM);
  m.runFrames(frames);
  return m.clone(); // clone neutralises the frame machinery (nextNmi/nextBoundary = Infinity)
}

/**
 * A crafted entry: a clone of `base` with the two target cells set to given priors,
 * noise stamped in their neighbours, and a safe stack. Frame machinery re-neutralised
 * for clarity so the oracle's terminal return cannot fire an NMI or push a frame.
 */
function makeEntry(base, marioPrior, edgePrior) {
  const e = base.clone();
  e.mem.write8(MARIO_ACTIVE, marioPrior);
  e.mem.write8(EDGE_FLAG, edgePrior);
  for (const [addr, val] of NOISE) e.mem.write8(addr, val);
  e.regs.sp = SAFE_SP;
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

/**
 * Run the oracle and the candidate on two FRESH, byte-identical crafted entries and
 * diff the memory-equivalence contract (RAM over the whole dump). A fresh entry per
 * side because the routine WRITES memory. Returns { addr, a, b } | null.
 */
function runPair(base, marioPrior, edgePrior, candidate) {
  const a = makeEntry(base, marioPrior, edgePrior); // oracle
  const b = makeEntry(base, marioPrior, edgePrior); // candidate
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

/**
 * The two 256-value prior sweeps. Together they prove the overwrite is unconditional
 * for each cell. Returns the first mismatch (or null) and the combos compared.
 */
function fullSweep(base, candidate) {
  let count = 0;

  // SWEEP A — MARIO_ACTIVE prior over all 256 values, edge flag fixed nonzero.
  for (let v = 0; v < 256; v++) {
    const ram = runPair(base, v, 0x7, candidate);
    count++;
    if (ram) return { mismatch: { marioPrior: v, edgePrior: 0x7, ram }, count };
  }

  // SWEEP B — edge-flag prior over all 256 values, MARIO_ACTIVE fixed nonzero.
  for (let v = 0; v < 256; v++) {
    const ram = runPair(base, 0x7, v, candidate);
    count++;
    if (ram) return { mismatch: { marioPrior: 0x7, edgePrior: v, ram }, count };
  }

  return { mismatch: null, count };
}

const describeMismatch = (mm) =>
  mm &&
  `at marioPrior=${hx(mm.marioPrior)} edgePrior=${hx(mm.edgePrior)}: ` +
    `RAM diverges at ${hx(mm.ram.addr ?? 0)} (${mm.ram.a}->${mm.ram.b})`;

// -- 0. REACHABILITY (informational) ------------------------------------------

test("REACHABILITY: 0x277F is NOT dispatched in attract — the gate rests on crafted entries", () => {
  let count = 0;
  const snap = new Map([[TARGET, (mm) => { count++; return oracle(mm); }]]);
  const host = new Machine(ROM, { overrides: snap });
  host.runFrames(4000);
  // The edge reset only fires when the vertical mover runs off its track, which attract
  // never does. This is why coverage is crafted (on a real attract base), not captured.
  assert.equal(count, 0, "expected 0x277F to stay unreached in attract; if it now fires, add captured coverage");
  console.log(`  REACHABILITY: ${count} natural 0x277F dispatches in 4000 frames — crafted coverage carries the gate`);
});

// -- 1. EQUAL (exhaustive) ----------------------------------------------------

test("EQUAL (exhaustive): loc_277f == oracle across both 256-value prior sweeps", () => {
  const base = attractBase();
  const { mismatch, count } = fullSweep(base, loc_277f);
  assert.equal(mismatch, null, describeMismatch(mismatch));
  assert.equal(count, 256 + 256, "must have compared both full prior sweeps");
  console.log(`  EQUAL/exhaustive: ${count} prior combos — RAM identical to the oracle`);
});

// -- 2. NON-VACUITY -----------------------------------------------------------

test("NON-VACUITY: the oracle's write set is exactly {MARIO_ACTIVE, edge flag}, both -> 0", () => {
  const base = attractBase();
  const pre = makeEntry(base, 0xff, 0xff);
  const after = pre.clone();
  oracle(after);

  // The two targets reach 0.
  assert.equal(after.mem.read8(MARIO_ACTIVE), 0, "MARIO_ACTIVE not cleared");
  assert.equal(after.mem.read8(EDGE_FLAG), 0, "edge flag not cleared");

  // Exactly those two cells changed (neighbour noise untouched); the compare is the
  // whole dump, so any stray write anywhere would show up here.
  const da = pre.dumpState(), db = after.dumpState();
  const changed = [];
  for (let i = 0; i < Math.min(da.length, db.length); i++) {
    if (da[i] !== db[i]) changed.push(pre.stateOffsetToAddr(i));
  }
  assert.deepEqual(changed.sort((x, y) => x - y), [MARIO_ACTIVE, EDGE_FLAG],
    `write set must be exactly the two targets, got [${changed.map(hx).join(", ")}]`);

  // Neighbours explicitly still hold their noise.
  for (const [addr, val] of NOISE) {
    assert.equal(after.mem.read8(addr), val, `neighbour ${hx(addr)} was disturbed`);
  }
  console.log("  NON-VACUITY: writes {MARIO_ACTIVE, 0x6398} -> 0, neighbours untouched");
});

// -- 3. TEETH (exhaustive) ----------------------------------------------------

/** BUG (a): clears only MARIO_ACTIVE, dropping the edge-flag write. */
function brokenDropEdge(m) {
  m.mem.write8(MARIO_ACTIVE, 0);
}

/** BUG (b): writes a nonzero value to MARIO_ACTIVE instead of 0. */
function brokenNonzeroMario(m) {
  m.mem.write8(MARIO_ACTIVE, 1);
  m.mem.write8(EDGE_FLAG, 0);
}

/** BUG (c): off-by-one target — clears the neighbour 0x6399, not the edge flag 0x6398. */
function brokenWrongCell(m) {
  m.mem.write8(MARIO_ACTIVE, 0);
  m.mem.write8(EDGE_FLAG + 1, 0);
}

test("TEETH (exhaustive): the dropped-edge-clear twin is CAUGHT at 0x6398", () => {
  const base = attractBase();
  const { mismatch } = fullSweep(base, brokenDropEdge);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a dropped edge-flag clear — worthless");
  assert.equal(mismatch.ram.addr, EDGE_FLAG, "the dropped-edge twin must diverge on the edge flag");
  console.log(`  TEETH/drop-edge: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the nonzero-MARIO twin is CAUGHT at 0x6200", () => {
  const base = attractBase();
  const { mismatch } = fullSweep(base, brokenNonzeroMario);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a nonzero MARIO_ACTIVE write — worthless");
  assert.equal(mismatch.ram.addr, MARIO_ACTIVE, "the nonzero-MARIO twin must diverge on MARIO_ACTIVE");
  console.log(`  TEETH/nonzero-mario: caught — ${describeMismatch(mismatch)}`);
});

test("TEETH (exhaustive): the off-by-one target twin is CAUGHT at 0x6398", () => {
  const base = attractBase();
  const { mismatch } = fullSweep(base, brokenWrongCell);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch a wrong write target — worthless");
  assert.equal(mismatch.ram.addr, EDGE_FLAG, "the off-by-one twin must diverge on the (un-cleared) edge flag");
  console.log(`  TEETH/wrong-cell: caught — ${describeMismatch(mismatch)}`);
});
