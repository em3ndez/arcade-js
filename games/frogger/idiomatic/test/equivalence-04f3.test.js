// SPDX-License-Identifier: GPL-3.0-only
/**
 * setUpPlayerTwoContinue — memory-equivalent to the frozen oracle at ROM 0x04F3.
 * GATE: crafted-entry. Sets the second continue flag 0x83ca=1; if 0x83c9!=0 jumps to the shared
 * cold-start mid-entry 0x0557 (severed at 0x0567); else clears the tilemap, hands to the other player,
 * seeds 0x83fe/0x825d and the 0x8263-0x8267 alternate gates, copies the saved object page (0x86c0->
 * 0x800c) and work page (0x8500->0x80ff) into the live pages, sets 0x803f=1, then the pace tail (severed).
 * Live-out memory-only; RAM compared, stack masked. Teeth: no-op, wrong attribute shadow, a skipped
 * gate. Positive control: the fresh path really sets the slot byte 0->1.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff } from "./_spineSetup.js";
import { setUpPlayerTwoContinue as cand } from "../setUpPlayerTwoContinue.js";
import { loc_04f3 as oracle } from "../../translated/loc_04f3.js";
import { withOmittedRet } from "../../machine.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const CONT = 0x83c9, SLOT2 = 0x825d, GATE0 = 0x8263, ATTR = 0x803f;

const toMid = () => craft((mem) => { mem[CONT] = 1; });
const fresh = () => craft((mem) => { mem[CONT] = 0; mem[SLOT2] = 0; mem[GATE0] = 0x44; });

test("EQUAL (crafted): setUpPlayerTwoContinue == oracle on both branches", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, toMid()), null, "continue->mid branch diverged");
  assert.equal(ramDiff(oracle, cand, fresh()), null, "fresh continue branch diverged");
  const e = fresh(); const a = e.clone(); a.routines = e.routines; oracle(a);
  assert.equal(a.mem8[SLOT2], 1, "positive control: fresh path sets the slot byte 0->1");
  console.log("  EQUAL: continue->mid, fresh; control slot 0->1");
});

test("TEETH: broken twins caught", { skip }, () => {
  const noOp = () => {};
  const wrongAttr = (m) => { cand(m); m.mem8[ATTR] = 0x55; };
  const skipGate = (m) => { cand(m); m.mem8[GATE0] = 0x44; };
  assert.ok(ramDiff(oracle, noOp, fresh()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongAttr, fresh()), "wrong-attr twin escaped");
  assert.ok(ramDiff(oracle, skipGate, fresh()), "skip-gate twin escaped");
  console.log("  TEETH: no-op, wrong-attr, skip-gate all caught");
});

test("SEAM: wireable — hands back the coroutine, SP never checked", { skip }, () => {
  for (const mk of [toMid, fresh]) {
    const r = withOmittedRet(cand, 0x04f3)(mk());
    assert.ok(r && typeof r.next === "function" && typeof r.throw === "function",
      "the seam must pass the coroutine handoff through as an iterator");
  }
  console.log("  SEAM: iterator handoff on both exits -> wireable");
});
