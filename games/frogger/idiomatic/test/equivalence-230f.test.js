// SPDX-License-Identifier: GPL-3.0-only
/**
 * setUpPlayStartOnce — memory-equivalent to the frozen oracle at ROM 0x230f.
 * GATE: crafted-entry. Guarded twice: returns unless mode 0x83d6==1 and the run flag 0x829b==0. Then it
 * clears 0x83b4, lays out the board through six dissolved leaves (display field, score field, lane
 * params, frog+arm objects, the home-group tile block with HL=0xa850, the frog object), runs the
 * frog-anim dispatcher (kept m.call 0x0faf, severed here), and raises 0x825b and the run flag 0x829b so
 * the layout runs exactly once. Live-out memory-only; RAM compared, stack masked. Teeth: no-op, skip
 * run-flag arm, wrong 0x825b. Positive control: the run flag 0x829b 0->1.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, SEAM_STUBS } from "./_spineDispatch.js";
import { setUpPlayStartOnce as cand } from "../setUpPlayStartOnce.js";
import { loc_230f as oracle } from "../../translated/loc_230f.js";
import { withOmittedRet } from "../../machine.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const MODE = 0x83d6, RUN = 0x829b, START_FLAG = 0x825b;

const notActive = () => craft((mem) => { mem[MODE] = 0; });
const running = () => craft((mem) => { mem[MODE] = 1; mem[RUN] = 1; });
const fullSetup = () => craft((mem) => { mem[MODE] = 1; mem[RUN] = 0; });

test("EQUAL (crafted): setUpPlayStartOnce == oracle on both guards + full setup", { skip }, () => {
  for (const [name, mk] of [["not-active", notActive], ["already-running", running], ["full-setup", fullSetup]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} branch diverged`);
  }
  const e = fullSetup(); const a = e.clone(); oracle(a);
  assert.equal(a.mem8[RUN], 1, "positive control: the run flag 0x829b really arms 0->1");
  console.log("  EQUAL: not-active/already-running/full-setup; control 0x829b 0->1");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipRunArm = (m) => { cand(m); m.mem8[RUN] = 0; };
  const wrongStartFlag = (m) => { cand(m); m.mem8[START_FLAG] = 0; };
  assert.ok(ramDiff(oracle, noOp, fullSetup()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, skipRunArm, fullSetup()), "skip-run-arm twin escaped");
  assert.ok(ramDiff(oracle, wrongStartFlag, fullSetup()), "wrong-start-flag twin escaped");
  console.log("  TEETH: no-op, skip-run-arm, wrong-start-flag all caught");
});

test("SEAM: wireable — delta-0 return on guard + full setup", { skip }, () => {
  const isIter = (r) => r && typeof r.next === "function" && typeof r.throw === "function";
  for (const [name, mk] of [
    ["guard", () => craft((mem) => { mem[MODE] = 0; }, SEAM_STUBS)],
    ["full-setup", () => craft((mem) => { mem[MODE] = 1; mem[RUN] = 0; }, SEAM_STUBS)],
  ]) {
    const r = withOmittedRet(cand, 0x230f)(mk());
    assert.ok(!isIter(r), `the ${name} branch must not hand back a coroutine`);
  }
  console.log("  SEAM: no throw on guard + full-setup -> wireable");
});
