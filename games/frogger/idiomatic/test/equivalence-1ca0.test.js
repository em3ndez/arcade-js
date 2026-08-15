// SPDX-License-Identifier: GPL-3.0-only
/**
 * beginFrogHopLeft — memory-equivalent to the frozen oracle at ROM 0x1CA0.
 * GATE: crafted-entry. The LEFT begin guards on frog Y and frog X, and on a fresh hop emits the hop
 * sound + stamps the rest sprite, primes the hop counter, then falls into the LEFT (horizontal) advance.
 * From a captured post-boot state the hop cells are poked to drive: the two position guards, fresh hop,
 * fresh with the sprite already set, in-progress, and the counter-wrap bail. Live-out memory-only; RAM
 * compared, stack masked. Teeth: no-op, wrong counter, wrong sprite; positive control the rest sprite stamps.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, FROG_X, FROG_Y, FROG_SPRITE, ARRIVAL, COUNTER, RELOAD, HDELTA } from "./_frogHop.js";
import { beginFrogHopLeft as cand } from "../animateFrogHop.js";
import { loc_1ca0 as oracle } from "../../translated/loc_1c41.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const REST_CODE = 0x21;

const base = (mem) => { mem[FROG_Y] = 0x50; mem[FROG_X] = 0x60; mem[ARRIVAL[3]] = 0; mem[RELOAD[3]] = 2; mem[HDELTA] = 3; };
const fresh = () => craft((mem) => { base(mem); mem[COUNTER[3]] = 0; mem[FROG_SPRITE] = 0x00; });
const freshSpriteSet = () => craft((mem) => { base(mem); mem[COUNTER[3]] = 0; mem[FROG_SPRITE] = REST_CODE; });
const inProgress = () => craft((mem) => { base(mem); mem[COUNTER[3]] = 5; });
const wrap = () => craft((mem) => { base(mem); mem[COUNTER[3]] = 0xff; });
const guardY = () => craft((mem) => { base(mem); mem[FROG_Y] = 0x20; mem[COUNTER[3]] = 0; });
const guardX = () => craft((mem) => { base(mem); mem[FROG_X] = 0x10; mem[COUNTER[3]] = 0; });

test("EQUAL (crafted): beginFrogHopLeft == oracle on guards/fresh/re-prime/in-progress/wrap", { skip }, () => {
  for (const [name, mk] of [["guard-Y", guardY], ["guard-X", guardX], ["fresh", fresh], ["sprite-set", freshSpriteSet], ["in-progress", inProgress], ["wrap", wrap]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  const e = fresh(); const before = e.mem8[FROG_SPRITE]; const a = e.clone(); oracle(a);
  assert.notEqual(a.mem8[FROG_SPRITE], before, "fresh-hop not exercised: rest sprite never stamped");
  console.log(`  EQUAL: guards/fresh/sprite-set/in-progress/wrap; fresh stamped sprite ${before}->${a.mem8[FROG_SPRITE]}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongCounter = (m) => { cand(m); m.mem8[COUNTER[3]] = (m.mem8[COUNTER[3]] + 1) & 0xff; };
  const wrongSprite = (m) => { cand(m); m.mem8[FROG_SPRITE] = (m.mem8[FROG_SPRITE] + 1) & 0xff; };
  assert.ok(ramDiff(oracle, noOp, fresh()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongCounter, fresh()), "wrong-counter twin escaped");
  assert.ok(ramDiff(oracle, wrongSprite, fresh()), "wrong-sprite twin escaped");
  console.log("  TEETH: no-op, wrong-counter, wrong-sprite all caught");
});
