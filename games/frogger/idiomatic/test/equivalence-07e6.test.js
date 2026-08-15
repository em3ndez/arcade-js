// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearActivePlayerWorkRam — crafted-entry equivalence vs the frozen player work-RAM clear.
 * Covers: the one-player return (PLAY_FLAG holds 1, nothing cleared); the two-player clear (PLAY_FLAG
 * holds 2, the frog block + home-bay gates zeroed); and PLAY_FLAG 0 also clears. RAM compared, stack
 * masked. Teeth: a no-op on the clear path, a twin skipping the gate region, a twin that clears when it
 * should return; positive control a frog-block cell really goes non-zero -> 0.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, PLAY_FLAG } from "./_frogHop.js";
import { clearActivePlayerWorkRam as cand } from "../clearActivePlayerWorkRam.js";
import { loc_07e6 as oracle } from "../../translated/loc_07e6.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const FROG_BLOCK = 0x8044, FROG_BLOCK_END = 0x8063, GATES = 0x8420, GATES_END = 0x842b;

const seedDirty = (mem) => {
  for (let a = FROG_BLOCK; a <= FROG_BLOCK_END; a++) mem[a] = 0xa5;
  for (let a = GATES; a <= GATES_END; a++) mem[a] = 0x5a;
};
const onePlayer = () => craft((mem) => { mem[PLAY_FLAG] = 1; seedDirty(mem); });
const twoPlayer = () => craft((mem) => { mem[PLAY_FLAG] = 2; seedDirty(mem); });
const zeroFlag = () => craft((mem) => { mem[PLAY_FLAG] = 0; seedDirty(mem); });

test("EQUAL (crafted): clearActivePlayerWorkRam == oracle on return/clear/clear", { skip }, () => {
  for (const [name, mk] of [["one-player", onePlayer], ["two-player", twoPlayer], ["zero-flag", zeroFlag]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  const e = twoPlayer(); const a = e.clone(); oracle(a);
  assert.equal(a.mem8[FROG_BLOCK], 0, "clear not exercised: the frog block was not zeroed");
  assert.notEqual(e.mem8[FROG_BLOCK], 0, "positive control vacuous: the frog block was already zero");
  const s = onePlayer(); const b = s.clone(); oracle(b);
  assert.equal(b.mem8[FROG_BLOCK], 0xa5, "one-player guard broken: cleared when it should return");
  console.log(`  EQUAL: return/clear/clear; two-player zeroed the frog block ${e.mem8[FROG_BLOCK]}->0`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipGates = (m) => { for (let a = FROG_BLOCK; a <= FROG_BLOCK_END; a++) m.mem8[a] = 0; }; // leaves the gate region
  const alwaysClear = (m) => m.call(0x07eb); // clears even for one player
  assert.ok(ramDiff(oracle, noOp, twoPlayer()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, skipGates, twoPlayer()), "skip-gates twin escaped");
  assert.ok(ramDiff(oracle, alwaysClear, onePlayer()), "always-clear twin escaped");
  console.log("  TEETH: no-op, skip-gates, always-clear all caught");
});
