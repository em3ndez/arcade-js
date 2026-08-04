// SPDX-License-Identifier: GPL-3.0-only
/**
 * Equivalence test for loc_2766 (ROM 0x2766) — start Mario falling + clear the edge-reposition flag.
 *
 * loc_2766 is a pure leaf that ignores all inputs and unconditionally writes two cells:
 * EDGE_REPOSITION_FLAG (0x6398) <- 0 and MARIO_START_FALL (0x6221) <- 1. It reads nothing, calls
 * nothing; its terminal `ret` only pops the stack (a read), so RAM is byte-identical to the oracle
 * over the whole dump with no STACK_SCRATCH exclusion.
 *
 *   1. EQUAL (exhaustive over priors) — because the routine only writes, sweep BOTH target cells over
 *      all 256 prior values on a real attract base and confirm loc_2766 == oracle on RAM. This proves
 *      it overwrites (not a no-op) to the fixed values regardless of the prior state.
 *   2. NON-VACUITY — the write set is exactly {0x6398->0, 0x6221->1}.
 *   3. TEETH — (a) a wrong-value twin (leaves the flag set / clears the fall trigger); (b) an
 *      off-by-one-address twin (writes the neighbour 0x6399/0x6220). Each caught by the sweep.
 *
 * Run: node --test games/dkong/idiomatic/test/equivalence-2766.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_2766 as oracle } from "../../translated/loc_2766.js";
import { loc_2766 } from "../loc_2766.js";
import { EDGE_REPOSITION_FLAG, MARIO_START_FALL } from "../names.js";
import { Machine } from "../../machine.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built — run 'make -C games/dkong rom'" }, fn);

const SAFE_SP = 0x6bf8; // the oracle's `ret` pops the stack; aim SP at valid work RAM

function makeEntry(base, priorFlag, priorFall) {
  const e = base.clone();
  e.regs.sp = SAFE_SP;
  e.mem.write8(EDGE_REPOSITION_FLAG, priorFlag);
  e.mem.write8(MARIO_START_FALL, priorFall);
  e.nextNmi = Infinity;
  e.nextBoundary = Infinity;
  return e;
}

function runPair(base, priorFlag, priorFall, candidate) {
  const a = makeEntry(base, priorFlag, priorFall);
  const b = makeEntry(base, priorFlag, priorFall);
  oracle(a);
  candidate(b);
  return firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
}

// Sweep both target cells over all 256 priors (paired) — 256 combos covering every prior of each.
function fullSweep(base, candidate) {
  let count = 0;
  for (let p = 0; p < 256; p++) {
    const ram = runPair(base, p, (p ^ 0xff) & 0xff, candidate);
    count++;
    if (ram) return { mismatch: { prior: p, ram }, count };
  }
  return { mismatch: null, count };
}

const hx16 = (v) => "0x" + (v & 0xffff).toString(16);
const describe = (mm) => mm && `prior=0x${mm.prior.toString(16)}: RAM diverges at ${hx16(mm.ram.addr ?? 0)} (${mm.ram.a}->${mm.ram.b})`;

test("EQUAL (exhaustive over priors): loc_2766 == oracle", () => {
  const base = new Machine(ROM).clone();
  const { mismatch, count } = fullSweep(base, loc_2766);
  assert.equal(mismatch, null, describe(mismatch));
  assert.equal(count, 256, "must have swept all 256 priors");

  const e = makeEntry(base, 0x55, 0xaa); oracle(e);
  assert.equal(e.mem.read8(EDGE_REPOSITION_FLAG), 0, "EDGE_REPOSITION_FLAG must be cleared to 0");
  assert.equal(e.mem.read8(MARIO_START_FALL), 1, "MARIO_START_FALL must be set to 1");
  console.log(`  EQUAL/exhaustive: ${count} priors — RAM identical to the oracle`);
});

/** BUG (a): leaves the flag set (writes 1) and clears the fall trigger (writes 0) — inverted. */
function brokenWrongValues(m) {
  const { mem } = m;
  mem.write8(EDGE_REPOSITION_FLAG, 1); // BUG
  mem.write8(MARIO_START_FALL, 0); // BUG
}

/** BUG (b): off-by-one addresses (neighbours) — writes never land on the real cells. */
function brokenWrongAddress(m) {
  const { mem } = m;
  mem.write8((EDGE_REPOSITION_FLAG + 1) & 0xffff, 0); // BUG: 0x6399
  mem.write8((MARIO_START_FALL - 1) & 0xffff, 1); // BUG: 0x6220
}

test("TEETH: the wrong-value twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenWrongValues);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch inverted write values — worthless");
  console.log(`  TEETH/wrong-value: caught — ${describe(mismatch)}`);
});

test("TEETH: the off-by-one-address twin is CAUGHT", () => {
  const base = new Machine(ROM).clone();
  const { mismatch } = fullSweep(base, brokenWrongAddress);
  assert.notEqual(mismatch, null, "the sweep FAILED to catch off-by-one addresses — worthless");
  console.log(`  TEETH/wrong-address: caught — ${describe(mismatch)}`);
});
