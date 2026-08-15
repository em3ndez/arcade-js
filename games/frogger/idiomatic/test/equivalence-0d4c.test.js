// SPDX-License-Identifier: GPL-3.0-only
/**
 * equivalence-0d4c — crafted-entry gate: initInPlayBoardOnce vs the frozen oracle. Covers the
 * already-initialised guard (early return) and the full first-time setup path; teeth catch a no-op,
 * a skipped guard mark, and a wrong lane-param seed; positive control proves the guard flag moves.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff } from "./_frogHop.js";
import { initInPlayBoardOnce as cand } from "../initInPlayBoardOnce.js";
import { loc_0d4c as oracle } from "../../translated/loc_0d4c.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const INIT_DONE = 0x83ba, PLAY_FLAG = 0x83fe, ACTIVE = 0x83fd, LANE_A = 0x801b;

const already = () => craft((mem) => { mem[INIT_DONE] = 1; mem[PLAY_FLAG] = 1; });
const fresh = () => craft((mem) => { mem[INIT_DONE] = 0; mem[PLAY_FLAG] = 1; mem[ACTIVE] = 1; mem[LANE_A] = 0; });

test("EQUAL: initInPlayBoardOnce == oracle (guard early return / fresh setup)", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, already()), null, "already-initialised path diverged");
  assert.equal(ramDiff(oracle, cand, fresh()), null, "fresh setup path diverged");
  const e = fresh(); const a = e.clone(); oracle(a);
  assert.equal(a.mem8[INIT_DONE], 1, "vacuous: guard flag never set");
  assert.equal(a.mem8[LANE_A], 0x04, "vacuous: lane param never seeded");
  console.log(`  EQUAL: guard ${e.mem8[INIT_DONE]}->${a.mem8[INIT_DONE]}, lane ${e.mem8[LANE_A]}->${a.mem8[LANE_A]}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipGuard = (m) => { cand(m); m.mem8[INIT_DONE] = 0; };
  const wrongLane = (m) => { cand(m); m.mem8[LANE_A] = 0x05; };
  assert.ok(ramDiff(oracle, noOp, fresh()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, skipGuard, fresh()), "skip-guard twin escaped");
  assert.ok(ramDiff(oracle, wrongLane, fresh()), "wrong-lane twin escaped");
  console.log("  TEETH: no-op, skip-guard, wrong-lane all caught");
});
