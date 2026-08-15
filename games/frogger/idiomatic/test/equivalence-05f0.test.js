// SPDX-License-Identifier: GPL-3.0-only
/**
 * equivalence-05f0 — crafted-entry gate: advanceBoardForeground vs the frozen oracle. Covers player 1
 * and player 2 index bumps, each in a no-wrap and a wrap-to-zero case; teeth catch a no-op, a wrong
 * wrapped index, and a skipped board-laid-out flag; positive control proves the index byte moves.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff } from "./_frogHop.js";
import { advanceBoardForeground as cand } from "../advanceBoardForeground.js";
import { loc_05f0 as oracle } from "../../translated/loc_05f0.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const ACTIVE = 0x83fd, P1 = 0x8293, P2 = 0x8294, LAID_OUT = 0x8380, PLAY = 0x83fe;

const p1NoWrap = () => craft((mem) => { mem[ACTIVE] = 1; mem[P1] = 2; mem[PLAY] = 1; mem[LAID_OUT] = 0; });
const p1Wrap = () => craft((mem) => { mem[ACTIVE] = 1; mem[P1] = 4; mem[PLAY] = 1; });
const p2NoWrap = () => craft((mem) => { mem[ACTIVE] = 2; mem[P2] = 1; mem[PLAY] = 1; });
const p2Wrap = () => craft((mem) => { mem[ACTIVE] = 2; mem[P2] = 4; mem[PLAY] = 1; });

test("EQUAL: advanceBoardForeground == oracle (p1/p2, wrap/no-wrap)", { skip }, () => {
  for (const [name, mk] of [["p1", p1NoWrap], ["p1-wrap", p1Wrap], ["p2", p2NoWrap], ["p2-wrap", p2Wrap]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  const e = p1NoWrap(); const a = e.clone(); oracle(a);
  assert.equal(a.mem8[P1], 3, "vacuous: player-1 index never bumped");
  assert.equal(a.mem8[LAID_OUT], 1, "vacuous: board-laid-out flag never set");
  const w = p1Wrap(); const aw = w.clone(); oracle(aw);
  assert.equal(aw.mem8[P1], 0, "vacuous: wrap never taken");
  console.log(`  EQUAL: p1 ${e.mem8[P1]}->${a.mem8[P1]}, wrap 4->${aw.mem8[P1]}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongWrap = (m) => { cand(m); m.mem8[P1] = 5; };
  const skipFlag = (m) => { cand(m); m.mem8[LAID_OUT] = 0; };
  assert.ok(ramDiff(oracle, noOp, p1NoWrap()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongWrap, p1Wrap()), "wrong-wrap twin escaped");
  assert.ok(ramDiff(oracle, skipFlag, p1NoWrap()), "skip-flag twin escaped");
  console.log("  TEETH: no-op, wrong-wrap, skip-flag all caught");
});
