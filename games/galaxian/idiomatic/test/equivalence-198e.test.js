// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_198e — memory-equivalent to the frozen oracle at ROM 0x198e.
 * Two live-out cells, both in the state dump: the advanced RNG seed (0x401e) and the movement selector
 * (0x423f). Paths:
 *   - OPEN: phase gate lands (0x425f=23 -> (23+9)&0x1f==0) and both master enables set -> both cells change.
 *   - CLOSED: phase gate misses (0x425f=0 -> 9) -> immediate return, nothing written.
 * EQUAL asserts ramDiff==null on both paths. Positive controls prove the oracle really advances the seed
 * and stores a 0/4/8 selector on the open path and touches neither on the closed path. Teeth: no-op,
 * wrong-selector (open) and a gate-ignoring twin (closed).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { loc_198e as cand } from "../loc_198e.js";
import { loc_198e as oracle } from "../../translated/loc_198e.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const PHASE = 0x425f;
const ENABLE_A = 0x4007;
const ENABLE_B = 0x4200;
const RNG_SEED = 0x401e;
const MOVE_CMD = 0x423f;
const SEED0 = 0x37;
const CMD_SEED = 0xaa; // not a valid selector, so any selector write is observable

// Open: (23+9)&0x1f==0 with both enables' bit0 set; RNG + selector seeded to known foreign values.
const openEntry = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[PHASE] = 23; mem[ENABLE_A] = 1; mem[ENABLE_B] = 1;
  mem[RNG_SEED] = SEED0; mem[MOVE_CMD] = CMD_SEED;
});
// Closed: phase gate misses -> the routine bails before any write.
const closedEntry = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mem[PHASE] = 0; mem[ENABLE_A] = 1; mem[ENABLE_B] = 1;
  mem[RNG_SEED] = SEED0; mem[MOVE_CMD] = CMD_SEED;
});

test("EQUAL (crafted): loc_198e == oracle advances the seed and stores a selector (open)", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, openEntry()), null, "loc_198e diverged on the open path");
  const a = openEntry(); oracle(a);
  assert.notEqual(a.mem8[RNG_SEED], SEED0, "positive control: oracle did not advance the seed");
  assert.ok([0, 4, 8].includes(a.mem8[MOVE_CMD]), "positive control: oracle did not store a 0/4/8 selector");
  assert.notEqual(a.mem8[MOVE_CMD], CMD_SEED, "positive control: oracle did not overwrite the selector");
  console.log(`  EQUAL: loc_198e == oracle (RAM); seed ${SEED0}->${a.mem8[RNG_SEED]}, selector ${a.mem8[MOVE_CMD]}`);
});

test("EQUAL (crafted): loc_198e == oracle bails on the closed phase gate", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, closedEntry()), null, "loc_198e diverged on the closed path");
  const a = closedEntry(); oracle(a);
  assert.equal(a.mem8[RNG_SEED], SEED0, "positive control: closed gate must not advance the seed");
  assert.equal(a.mem8[MOVE_CMD], CMD_SEED, "positive control: closed gate must not write the selector");
  console.log("  EQUAL: loc_198e == oracle (RAM), phase gate closed -> no writes");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongCmd = (m) => { cand(m); m.mem8[MOVE_CMD] = (m.mem8[MOVE_CMD] + 1) & 0xff; };
  const ignoreGate = (m) => { m.mem8[MOVE_CMD] = 4; };
  assert.ok(ramDiff(oracle, noOp, openEntry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongCmd, openEntry()), "the wrong-selector twin escaped");
  assert.ok(ramDiff(oracle, ignoreGate, closedEntry()), "the gate-ignoring twin escaped");
  console.log("  TEETH: no-op, wrong-selector (open) and gate-ignoring (closed) all caught");
});
