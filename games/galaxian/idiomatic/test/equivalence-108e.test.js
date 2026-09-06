// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_108e — crafted-entry equivalence vs the frozen dispatch-state handler at ROM 0x108e, whose body
 * is a lone jp into the shared path-move step; the idiomatic candidate forwards to that same decompiled
 * step. Every live-out is the object record in work RAM (position, cursor, throttle, leg counter, cross
 * field, state) — no register or latch output — so equivalence is asserted with ramDiff alone across the
 * walk path, a leg-expiry state advance, and an off-near-edge drop to state 5. Teeth: no-op and per-cell
 * scribbles proving the diff sees each output. The return-stack window is masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { advanceObjectPathStepAlias as cand } from "../advanceObjectPathStepAlias.js";
import { loc_108e as oracle } from "../../translated/loc_108e.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const OBJ = 0x4300; // object record in work RAM, clear of the masked stack window
const STATE = 2, POS_Y = 3, POS_X = 4, CROSS = 5, CURSOR = 19;

// A crafted object with the fields the step reads; `dir` picks the X direction, `x`/`cur`/`thr`/`legs`
// steer which branch runs. push16 lays the return address the forwarded step's ret consumes.
function entry(cur, dir, x, thr, legs, y = 0x30) {
  return craft((mem8, mm) => {
    mm.push16(0x9999);
    mm.regs.ix = OBJ;
    mem8[OBJ + CURSOR] = cur;
    mem8[OBJ + 6] = dir;
    mem8[OBJ + POS_X] = x;
    mem8[OBJ + POS_Y] = y;
    mem8[OBJ + 16] = thr;
    mem8[OBJ + 17] = legs;
    mem8[OBJ + CROSS] = 0x20;
    mem8[OBJ + STATE] = 3;
  });
}

const walk = () => entry(0x40, 0x00, 0x80, 5, 2);
const legExpiry = () => entry(0x40, 0x00, 0x80, 1, 1);
const offEdge = () => entry(0x00, 0x00, 0x02, 5, 2);

test("EQUAL (crafted): loc_108e == oracle forwards to the path-move step", { skip }, () => {
  for (const [name, e] of [["walk", walk()], ["leg", legExpiry()], ["edge", offEdge()]]) {
    assert.equal(ramDiff(oracle, cand, e), null, `loc_108e diverged on ${name}`);
  }
  // non-vacuous: the oracle really moves X, drops to the edge state, advances state on leg expiry.
  const w = walk(); oracle(w);
  assert.equal(w.mem8[OBJ + POS_X], 0x81, "positive control: oracle stepped X on the walk path");
  const o = offEdge(); oracle(o);
  assert.equal(o.mem8[OBJ + STATE], 5, "positive control: oracle dropped to the edge state");
  const l = legExpiry(); oracle(l);
  assert.equal(l.mem8[OBJ + STATE], 4, "positive control: oracle advanced the state on leg expiry");
  console.log("  EQUAL: loc_108e == oracle (RAM) on walk/leg/edge");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const scribbleX = (m) => { cand(m); m.mem8[OBJ + POS_X] = m.mem8[OBJ + POS_X] + 1; };
  const scribbleState = (m) => { cand(m); m.mem8[OBJ + STATE] = m.mem8[OBJ + STATE] + 1; };
  const scribbleCursor = (m) => { cand(m); m.mem8[OBJ + CURSOR] = m.mem8[OBJ + CURSOR] + 1; };
  assert.ok(ramDiff(oracle, noOp, walk()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, scribbleX, walk()), "the X-scribble twin escaped");
  assert.ok(ramDiff(oracle, scribbleState, walk()), "the state-scribble twin escaped");
  assert.ok(ramDiff(oracle, scribbleCursor, walk()), "the cursor-scribble twin escaped");
  console.log("  TEETH: no-op, X/state/cursor scribbles all caught");
});
