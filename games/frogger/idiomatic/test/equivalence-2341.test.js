// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveInPlayFrameUpdate — memory-equivalent to the frozen oracle at ROM 0x2341.
 * GATE: crafted-entry (spine dispatcher). Guarded twice: returns unless GAME_MODE 0x83d6==1 and the run
 * flag 0x829b!=0. Then it drives the frame through the sub-engine sequence, dissolving the moved-0
 * leaves and keeping m.call for the collision orchestrator 0x1a55 and the two tail-transferring lane
 * engines (0x2005, 0x11bf), all still oracle-served here. Live-out memory-only; RAM compared, stack
 * masked. Teeth: no-op, skipped engine effect, wrong engine effect. Positive control: the free-running
 * counter 0x8014 arms 0->1 when the body runs.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, SEAM_STUBS } from "./_spineDispatch.js";
import { driveInPlayFrameUpdate as cand } from "../driveInPlayFrameUpdate.js";
import { loc_2341 as oracle } from "../../translated/loc_2341.js";
import { withOmittedRet } from "../../machine.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const MODE = 0x83d6, RUN = 0x829b, COUNTER = 0x8014, SPRITE_CELL = 0x8030;

const notActive = () => craft((mem) => { mem[MODE] = 0; });
const runClear = () => craft((mem) => { mem[MODE] = 1; mem[RUN] = 0; });
const body = () => craft((mem) => { mem[MODE] = 1; mem[RUN] = 1; });

test("EQUAL (crafted): driveInPlayFrameUpdate == oracle on both guards + full body", { skip }, () => {
  for (const [name, mk] of [["not-active", notActive], ["run-clear", runClear], ["body", body]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} branch diverged`);
  }
  const e = body(); const before = e.mem8[COUNTER]; const a = e.clone(); oracle(a);
  assert.equal(before, 0, "positive control seed: 0x8014 starts at 0");
  assert.equal(a.mem8[COUNTER], 1, "positive control: the body arms the free-running counter 0x8014 0->1");
  console.log("  EQUAL: not-active/run-clear/body; control 0x8014 0->1");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipCounter = (m) => { cand(m); m.mem8[COUNTER] = 0; };
  const wrongSprite = (m) => { cand(m); m.mem8[SPRITE_CELL] = (m.mem8[SPRITE_CELL] + 1) & 0xff; };
  assert.ok(ramDiff(oracle, noOp, body()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, skipCounter, body()), "skip-counter twin escaped");
  assert.ok(ramDiff(oracle, wrongSprite, body()), "wrong-sprite twin escaped");
  console.log("  TEETH: no-op, skip-counter, wrong-sprite all caught");
});

test("SEAM: wireable — delta-0 return on guard + full body", { skip }, () => {
  const isIter = (r) => r && typeof r.next === "function" && typeof r.throw === "function";
  for (const [name, mk] of [
    ["guard", () => craft((mem) => { mem[MODE] = 0; }, SEAM_STUBS)],
    ["body", () => craft((mem) => { mem[MODE] = 1; mem[RUN] = 1; }, SEAM_STUBS)],
  ]) {
    const r = withOmittedRet(cand, 0x2341)(mk());
    assert.ok(!isIter(r), `the ${name} branch must not hand back a coroutine`);
  }
  console.log("  SEAM: no throw on guard + body -> wireable");
});
