// SPDX-License-Identifier: GPL-3.0-only
/**
 * beginFrogHopUp — memory-equivalent to the frozen oracle at ROM 0x1BE4.
 * GATE: crafted-entry. The UP begin has no position guard; on a fresh hop it emits the hop sound +
 * stamps the rest sprite, primes the hop counter from its reload length, then falls into the UP advance
 * (which steps the slot cursor and, on arrival, scores). From a captured post-boot state the hop cells are
 * poked to drive: fresh hop, fresh with the sprite already set (re-prime, no bump), in-progress, and the
 * counter-wrap bail. Live-out memory-only; RAM compared, stack masked. Teeth: no-op, wrong counter, wrong
 * sprite; positive control the rest sprite stamps.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, FROG_Y, FROG_SPRITE, ARRIVAL, COUNTER, RELOAD, VDELTA } from "./_frogHop.js";
import { beginFrogHopUp as cand } from "../animateFrogHop.js";
import { loc_1be4 as oracle } from "../../translated/loc_1b8b.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const REST_CODE = 0x1e;

const base = (mem) => { mem[FROG_Y] = 0x50; mem[ARRIVAL[1]] = 0; mem[RELOAD[1]] = 2; mem[VDELTA] = 3; };
const fresh = () => craft((mem) => { base(mem); mem[COUNTER[1]] = 0; mem[FROG_SPRITE] = 0x00; });
const freshSpriteSet = () => craft((mem) => { base(mem); mem[COUNTER[1]] = 0; mem[FROG_SPRITE] = REST_CODE; });
const inProgress = () => craft((mem) => { base(mem); mem[COUNTER[1]] = 5; });
const wrap = () => craft((mem) => { base(mem); mem[COUNTER[1]] = 0xff; });

test("EQUAL (crafted): beginFrogHopUp == oracle on fresh/re-prime/in-progress/wrap", { skip }, () => {
  for (const [name, mk] of [["fresh", fresh], ["sprite-set", freshSpriteSet], ["in-progress", inProgress], ["wrap", wrap]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  const e = fresh(); const before = e.mem8[FROG_SPRITE]; const a = e.clone(); oracle(a);
  assert.notEqual(a.mem8[FROG_SPRITE], before, "fresh-hop not exercised: rest sprite never stamped");
  console.log(`  EQUAL: fresh/sprite-set/in-progress/wrap; fresh stamped sprite ${before}->${a.mem8[FROG_SPRITE]}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongCounter = (m) => { cand(m); m.mem8[COUNTER[1]] = (m.mem8[COUNTER[1]] + 1) & 0xff; };
  const wrongSprite = (m) => { cand(m); m.mem8[FROG_SPRITE] = (m.mem8[FROG_SPRITE] + 1) & 0xff; };
  assert.ok(ramDiff(oracle, noOp, fresh()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongCounter, fresh()), "wrong-counter twin escaped");
  assert.ok(ramDiff(oracle, wrongSprite, fresh()), "wrong-sprite twin escaped");
  console.log("  TEETH: no-op, wrong-counter, wrong-sprite all caught");
});
