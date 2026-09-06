// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0bbe — memory-equivalent to the frozen oracle at ROM 0x0bbe.
 * Live-out: the 32-byte sprite shadow (8 records of Y/attr/#/X), all work-RAM cells in the state
 * dump, so ramDiff observes them directly (no register or io live-out). The seed clears the shadow,
 * lays 8 active source objects with distinct fields (so each render write is non-trivial and the
 * per-band Y offset matters), and sets the orientation flag; both orientations are exercised.
 * Teeth: no-op, a flat-offset renderer (ignores the first band's distinct offset), a wrong-split
 * renderer (5+3 instead of 3+5), and a scribble proving ramDiff still bites this region.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { stageObjectsToSpriteShadow as cand } from "../stageObjectsToSpriteShadow.js";
import { loc_0bbe as oracle } from "../../translated/loc_0bbe.js";
import { renderObjectSprite } from "../renderObjectSprite.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const ORIENTATION = 0x4018;
const OBJ_BASE = 0x42b0;
const SHADOW_BASE = 0x4060;
const OBJ_STRIDE = 0x20;
const SHADOW_BYTES = 8 * 4;

// A fresh seed: shadow cleared, 8 active source objects with distinct fields, orientation `flip`,
// and a ret word for the oracle's final ret.
function seed(flip) {
  return craft((mem, m) => {
    m.push16(0x9999);
    mem[ORIENTATION] = flip;
    for (let i = 0; i < SHADOW_BYTES; i++) mem[SHADOW_BASE + i] = 0;
    for (let k = 0; k < 8; k++) {
      const o = OBJ_BASE + k * OBJ_STRIDE;
      mem[o + 0x00] = 1;        // primary active flag
      mem[o + 0x03] = 0x40 + k; // X
      mem[o + 0x04] = 0x50 + k; // Y
      mem[o + 0x05] = 0;        // angle -> deterministic fold path
      mem[o + 0x0f] = 0x02 + k; // attr base
      mem[o + 0x16] = 0x10 + k; // sprite #
    }
  });
}

// Render 8 objects at a caller-chosen offset per row (used to build deliberately-wrong twins).
function render8(m, offsets) {
  let obj = OBJ_BASE, spr = SHADOW_BASE;
  for (let k = 0; k < 8; k++) {
    renderObjectSprite(m, obj, spr, offsets[k]);
    obj += OBJ_STRIDE;
    spr += 4;
  }
}

test("EQUAL (crafted): loc_0bbe == oracle, normal orientation", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, seed(0)), null, "loc_0bbe diverged, normal orientation");
  // non-vacuous: oracle wrote the first record's Y = (255 - 0x50 - 7) + 1 = 169.
  const a = seed(0); oracle(a);
  assert.equal(a.mem8[SHADOW_BASE], 169, "positive control: oracle did not stage the first sprite Y");
  console.log("  EQUAL: normal orientation, first band offset 7 / tail 8");
});

test("EQUAL (crafted): loc_0bbe == oracle, flipped orientation", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, seed(1)), null, "loc_0bbe diverged, flipped orientation");
  // flipped first band uses offset 9: Y = (255 - 0x50 - 9) + 1 = 167, distinct from normal's 169.
  const a = seed(1); oracle(a);
  assert.equal(a.mem8[SHADOW_BASE], 167, "positive control: flip did not change the first band offset");
  console.log("  EQUAL: flipped orientation, first band offset 9 / tail 8");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const flatOffset = (m) => render8(m, [8, 8, 8, 8, 8, 8, 8, 8]);        // ignores the 3-row offset
  const wrongSplit = (m) => render8(m, [7, 7, 7, 7, 7, 8, 8, 8]);        // 5+3 instead of 3+5
  const scribble = (m) => { cand(m); m.mem8[SHADOW_BASE] ^= 0xff; };     // ramDiff sensitivity

  assert.ok(ramDiff(oracle, noOp, seed(0)), "no-op twin escaped");
  assert.ok(ramDiff(oracle, flatOffset, seed(0)), "flat-offset twin escaped");
  assert.ok(ramDiff(oracle, wrongSplit, seed(0)), "wrong-split twin escaped");
  assert.ok(ramDiff(oracle, scribble, seed(0)), "scribble twin escaped (ramDiff teeth)");
  console.log("  TEETH: no-op, flat-offset, wrong-split, scribble all caught");
});
