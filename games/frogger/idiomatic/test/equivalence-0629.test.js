// SPDX-License-Identifier: GPL-3.0-only
/**
 * equivalence-0629 — crafted-entry gate: clearAndSeedScoreField vs the frozen oracle. Covers the
 * single-player and two-player work-RAM-clear branches of the leading clear call; teeth catch a no-op,
 * a skipped seed flag, and a wrong fill tile; positive control proves the seed flag and a field cell move.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff } from "./_frogHop.js";
import { clearAndSeedScoreField as cand } from "../clearAndSeedScoreField.js";
import { loc_0629 as oracle } from "../../translated/loc_0629.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const PLAY_FLAG = 0x83fe, SEED_FLAG = 0x83cc, FIELD0 = 0xa806, CURSOR_LO = 0x839a;

const single = () => craft((mem) => { mem[PLAY_FLAG] = 1; mem[SEED_FLAG] = 0; mem[FIELD0] = 0; mem[CURSOR_LO] = 0xff; });
const twoPlayer = () => craft((mem) => { mem[PLAY_FLAG] = 2; mem[SEED_FLAG] = 0; mem[FIELD0] = 0; });

test("EQUAL: clearAndSeedScoreField == oracle (single / two-player clear branch)", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, single()), null, "single-player path diverged");
  assert.equal(ramDiff(oracle, cand, twoPlayer()), null, "two-player path diverged");
  const e = single(); const a = e.clone(); oracle(a);
  assert.equal(a.mem8[SEED_FLAG], 1, "vacuous: seed flag never set");
  assert.equal(a.mem8[FIELD0], 16, "vacuous: field cell never tiled");
  console.log(`  EQUAL: seed ${e.mem8[SEED_FLAG]}->${a.mem8[SEED_FLAG]}, field ${e.mem8[FIELD0]}->${a.mem8[FIELD0]}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipFlag = (m) => { cand(m); m.mem8[SEED_FLAG] = 0; };
  const wrongTile = (m) => { cand(m); m.mem8[FIELD0] = 0x11; };
  assert.ok(ramDiff(oracle, noOp, single()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, skipFlag, single()), "skip-flag twin escaped");
  assert.ok(ramDiff(oracle, wrongTile, single()), "wrong-tile twin escaped");
  console.log("  TEETH: no-op, skip-flag, wrong-tile all caught");
});
