// SPDX-License-Identifier: GPL-3.0-only
/**
 * forceClearPlayerWorkRam — crafted-entry equivalence vs the frozen unconditional player work-RAM clear
 * at ROM 0x07eb. The routine zeroes the frog object block (0x8044-0x8063) and the home-bay gate block
 * (0x8420-0x842b) with no guard. RAM compared, dead stack scratch masked; the oracle's ROM `ret` only
 * moves the (masked) stack, which the idiomatic form legitimately omits. Teeth: a no-op, a twin that
 * skips the gate block, a twin that skips the frog block; positive control a seeded cell goes 0xa5 -> 0.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff } from "./_frogHop.js";
import { forceClearPlayerWorkRam as cand } from "../forceClearPlayerWorkRam.js";
import { loc_07eb as oracle } from "../../translated/loc_07e6.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const FROG_BLOCK = 0x8044, FROG_BLOCK_END = 0x8063, GATES = 0x8420, GATES_END = 0x842b;

const seeded = () => craft((mem) => {
  for (let a = FROG_BLOCK; a <= FROG_BLOCK_END; a++) mem[a] = 0xa5;
  for (let a = GATES; a <= GATES_END; a++) mem[a] = 0x5a;
});

test("EQUAL (crafted): forceClearPlayerWorkRam == oracle", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, seeded()), null, "force-clear diverged");
  const e = seeded(); const a = e.clone(); oracle(a);
  assert.equal(a.mem8[FROG_BLOCK], 0, "positive control: frog-block cell 0xa5 -> 0");
  assert.equal(a.mem8[FROG_BLOCK_END], 0, "positive control: frog-block last cell 0xa5 -> 0");
  assert.equal(a.mem8[GATES], 0, "positive control: gate cell 0x5a -> 0");
  assert.equal(a.mem8[GATES_END], 0, "positive control: gate last cell 0x5a -> 0");
  assert.notEqual(e.mem8[FROG_BLOCK], 0, "positive control vacuous: the frog block was already zero");
  console.log(`  EQUAL: force-clear; frog block ${e.mem8[FROG_BLOCK]}->0, gates ${e.mem8[GATES]}->0`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipGates = (m) => { for (let a = FROG_BLOCK; a <= FROG_BLOCK_END; a++) m.mem8[a] = 0; };
  const skipFrogBlock = (m) => { for (let a = GATES; a <= GATES_END; a++) m.mem8[a] = 0; };
  assert.ok(ramDiff(oracle, noOp, seeded()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, skipGates, seeded()), "skip-gates twin escaped");
  assert.ok(ramDiff(oracle, skipFrogBlock, seeded()), "skip-frog-block twin escaped");
  console.log("  TEETH: no-op, skip-gates, skip-frog-block all caught");
});
