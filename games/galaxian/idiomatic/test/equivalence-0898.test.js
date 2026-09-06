// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0898 — memory-equivalent to the frozen oracle at ROM 0x0898 (dissolves its call of the shot-block
 * service into a direct idiomatic call). After the delegate updates the shot block, the routine reads the
 * block's {counter, field} back and writes the shot's two render cells (0x409f, 0x409d), complementing the
 * field; the direction flag (0x4018 bit0) picks the X formula. All live-outs are work RAM (the delegate's
 * block 0x4209/0x420a/0x420b AND the two render cells), so EQUAL is asserted on ramDiff over three paths:
 * direction set + drain, direction clear + drain, and the delegate's reset path. Teeth: a no-op, a
 * render-cell scribble, and a delegate-block scribble. The return-stack window is masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { advancePlayerShotAndStageSprite as cand } from "../advancePlayerShotAndStageSprite.js";
import { loc_0898 as oracle } from "../../translated/loc_0898.js";

const DIR_FLAG = 0x4018;
const GATE = 0x4208, COUNTER = 0x4209, FIELD = 0x420a, FLAG = 0x420b;
const TRIGGER = 0x4200, SOURCE = 0x4202;
const RENDER_X = 0x409f, RENDER_ATTR = 0x409d;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// drain path (gate armed): the delegate subtracts 4 from the counter and leaves the field alone.
const dirSet = () => craft((mem, m) => {
  m.push16(0x9999);
  mem[DIR_FLAG] = 0x01; mem[GATE] = 0x01; mem[COUNTER] = 0x50; mem[FIELD] = 0x30; mem[FLAG] = 0;
  mem[RENDER_X] = 0xaa; mem[RENDER_ATTR] = 0xbb;
});
const dirClear = () => craft((mem, m) => {
  m.push16(0x9999);
  mem[DIR_FLAG] = 0x00; mem[GATE] = 0x01; mem[COUNTER] = 0x50; mem[FIELD] = 0x30; mem[FLAG] = 0;
  mem[RENDER_X] = 0xaa; mem[RENDER_ATTR] = 0xbb;
});
// reset path (gate idle): the delegate reloads the counter (220) and seeds the field from the source.
const resetPath = () => craft((mem, m) => {
  m.push16(0x9999);
  mem[DIR_FLAG] = 0x01; mem[GATE] = 0x00; mem[TRIGGER] = 0x01; mem[SOURCE] = 0x77; mem[COUNTER] = 0x50;
  mem[RENDER_X] = 0xaa; mem[RENDER_ATTR] = 0xbb;
});

test("EQUAL (crafted): loc_0898 == oracle across both X formulas and the delegate reset", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, dirSet()), null, "loc_0898 diverged on the direction-set path");
  assert.equal(ramDiff(oracle, cand, dirClear()), null, "loc_0898 diverged on the direction-clear path");
  assert.equal(ramDiff(oracle, cand, resetPath()), null, "loc_0898 diverged on the delegate reset path");
  // positive control: on the drain + direction-set path the delegate drains the counter 0x50->0x4c and the
  // render cells become (counter - 1) and complement(field).
  const a = dirSet(); oracle(a);
  assert.equal(a.mem8[COUNTER], 0x4c, "positive control: delegate drained the counter");
  assert.equal(a.mem8[RENDER_X], 0x4b, "positive control: render X = counter - 1");
  assert.equal(a.mem8[RENDER_ATTR], (~0x30) & 0xff, "positive control: render attr = complement(field)");
  console.log("  EQUAL: loc_0898 == oracle (RAM), both X formulas + delegate reset");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const scribbleRender = (m) => { cand(m); m.mem8[RENDER_X] = m.mem8[RENDER_X] ^ 0xff; };
  const scribbleBlock = (m) => { cand(m); m.mem8[COUNTER] = (m.mem8[COUNTER] + 1) & 0xff; };
  assert.ok(ramDiff(oracle, noOp, dirSet()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, scribbleRender, dirSet()), "the render-scribble twin escaped");
  assert.ok(ramDiff(oracle, scribbleBlock, dirSet()), "the delegate-block scribble twin escaped");
  console.log("  TEETH: no-op, render-cell scribble, delegate-block scribble all caught");
});
