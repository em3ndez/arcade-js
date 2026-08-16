// SPDX-License-Identifier: GPL-3.0-only
/**
 * setUpBoardOrContinueLife — memory-equivalent to the frozen oracle at ROM 0x040b.
 * GATE: crafted-entry. When the continue flag 0x83ea is set it tail-hands to beginNextLifeOrIntro; else
 * it lays out a fresh board -- the 2-player bank swap (0x83cd==0 && 0x83fe!=1), score header, the
 * extra-life foreground (0x826d!=0), board build (kept m.call 0x0942), time bar, the three HUD stamps
 * at 0x839c-0x839e, the 2-player start flag, then clears 0x826d, mirrors 0x83cd->0x83b6, redraws the
 * lives row, and tail-enters the pace tail (severed). Live-out memory-only; RAM compared, stack masked.
 * Teeth: no-op, skip-0x826d-clear, wrong-0x83b6, wrong-HUD. Positive control: 0x826d 5->0.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, STUBS, SEAM_STUBS } from "./_spineDispatch.js";
import { setUpBoardOrContinueLife as cand } from "../setUpBoardOrContinueLife.js";
import { loc_040b as oracle } from "../../translated/loc_040b.js";
import { withOmittedRet } from "../../machine.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const CONTINUE = 0x83ea, SWAP = 0x83cd, PLAYERS = 0x83fe, REQ = 0x826d, MIRROR = 0x83b6, HUD = 0x839e;

const cont = () => craft((mem) => { mem[CONTINUE] = 1; mem[0x83ce] = 0; });
const swapPending = () => craft((mem) => { mem[CONTINUE] = 0; mem[SWAP] = 1; mem[REQ] = 0; });
const onePlayer = () => craft((mem) => { mem[CONTINUE] = 0; mem[SWAP] = 0; mem[PLAYERS] = 1; mem[REQ] = 0; });
const twoPlayer = () => craft((mem) => { mem[CONTINUE] = 0; mem[SWAP] = 0; mem[PLAYERS] = 2; mem[REQ] = 0; });
const extraLife = () => craft((mem) => { mem[CONTINUE] = 0; mem[SWAP] = 1; mem[REQ] = 5; });

test("EQUAL (crafted): setUpBoardOrContinueLife == oracle on continue + four setup branches", { skip }, () => {
  for (const [name, mk] of [["continue", cont], ["swap-pending", swapPending], ["1P", onePlayer], ["2P", twoPlayer], ["extra-life", extraLife]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} branch diverged`);
  }
  const e = extraLife(); const a = e.clone(); oracle(a);
  assert.equal(a.mem8[REQ], 0, "positive control: the request cell 0x826d really clears 5->0");
  console.log("  EQUAL: continue/swap-pending/1P/2P/extra-life; control 0x826d 5->0");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipReqClear = (m) => { cand(m); m.mem8[REQ] = 7; };
  const wrongMirror = (m) => { cand(m); m.mem8[MIRROR] = (m.mem8[MIRROR] + 1) & 0xff; };
  const wrongHud = (m) => { cand(m); m.mem8[HUD] = 0; };
  assert.ok(ramDiff(oracle, noOp, swapPending()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, skipReqClear, craft((mem) => { mem[CONTINUE] = 0; mem[SWAP] = 1; mem[REQ] = 7; })), "skip-request-clear twin escaped");
  assert.ok(ramDiff(oracle, wrongMirror, swapPending()), "wrong-mirror twin escaped");
  assert.ok(ramDiff(oracle, wrongHud, swapPending()), "wrong-HUD twin escaped");
  console.log("  TEETH: no-op, skip-request-clear, wrong-mirror, wrong-HUD all caught");
});

test("SEAM: wireable — hands back the pace-tail coroutine", { skip }, () => {
  for (const mk of [() => craft((mem) => { mem[CONTINUE] = 1; mem[0x83ce] = 0; }, SEAM_STUBS),
                    () => craft((mem) => { mem[CONTINUE] = 0; mem[SWAP] = 1; mem[REQ] = 0; }, SEAM_STUBS)]) {
    const r = withOmittedRet(cand, 0x040b)(mk());
    assert.ok(r && typeof r.next === "function" && typeof r.throw === "function",
      "the seam must pass the coroutine hand-off through as an iterator");
  }
  console.log("  SEAM: iterator hand-off on continue + setup -> wireable");
});
