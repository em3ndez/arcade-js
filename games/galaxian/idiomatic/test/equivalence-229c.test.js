// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_229c — memory-equivalent to the frozen oracle at ROM 0x229c, with the fall-through into the marker-row
 * painter dissolved to the decompiled module. A one-shot per current player: index the per-player flag table
 * by the active player; if that slot's bit0 is already set, return untouched. Otherwise set the slot, raise
 * the sound-envelope trigger, bump the marker counter, and repaint the marker row with the new count. Whole
 * contract is RAM (the flag byte, the trigger, the counter, and the repainted marker-row VRAM) -- the caller
 * dispatches and reads no register back. EQUAL asserts ramDiff==null across the fresh path for each player,
 * the already-flagged no-op, and the object-active drop/blank paths of the row paint. Teeth: no-op, an
 * ignore-the-guard twin, and a forget-the-counter twin. Plus an SP-seam tooth; a stack-adrift mutant is refused.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { loc_229c as cand } from "../loc_229c.js";
import { loc_229c as oracle } from "../../translated/loc_229c.js";
import { drawMarkerRow } from "../drawMarkerRow.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const PLAYER = 0x400d;                 // current-player index
const FLAG0 = 0x40ad, FLAG1 = 0x40ae;  // per-player one-shot flag table
const TRIGGER = 0x41c7;                // sound-envelope trigger raised on the fresh path
const COUNTER = 0x421d;                // marker counter (bumped, then read as the row count)
const ACTIVE = 0x4200;                 // object-active flag: nonzero drops one marker in the row paint
const ROW = 0x539e;                    // marker-row VRAM cell, blocks grow upward by -0x40
const SENT = 0x77;                     // pre-poked into the row cells so the repaint is demonstrable
const MARKER = 102;                    // marker tile seed

const blockCells = (dst) => [dst, (dst + 1) & 0xffff, (dst - 0x20) & 0xffff, (dst - 0x1f) & 0xffff];
const blockAt = (i) => (ROW - i * 0x40) & 0xffff;
function seedRow(mem) { for (let i = 0; i < 5; i++) for (const c of blockCells(blockAt(i))) mem[c] = SENT; }

const entry = (player, flag, counter, active = 0) => craft((mem, mm) => {
  mem[PLAYER] = player; mem[FLAG0] = 0; mem[FLAG1] = 0;
  mem[player === 0 ? FLAG0 : FLAG1] = flag;
  mem[COUNTER] = counter; mem[TRIGGER] = 0; mem[ACTIVE] = active;
  seedRow(mem); mm.push16(0x9999);
});

test("EQUAL (crafted): loc_229c == oracle across the flag/paint paths (RAM)", { skip }, () => {
  const cases = [
    ["p0-fresh", entry(0, 0, 0)], ["p0-flagged", entry(0, 1, 4)],
    ["p1-fresh", entry(1, 0, 2)], ["p0-active-drop", entry(0, 0, 2, 1)],
    ["p0-active-empty", entry(0, 0, 0, 1)],
  ];
  for (const [name, e] of cases) assert.equal(ramDiff(oracle, cand, e), null, `loc_229c diverged on ${name}`);

  // positive control: the fresh path flags the slot, raises the trigger, bumps the counter, repaints the row.
  const f = entry(0, 0, 0); f.routines = STUBS; oracle(f);
  assert.equal(f.mem8[FLAG0], 1, "control: fresh path did not flag the player-0 slot");
  assert.equal(f.mem8[TRIGGER], 1, "control: fresh path did not raise the trigger");
  assert.equal(f.mem8[COUNTER], 1, "control: fresh path did not bump the counter");
  assert.equal(f.mem8[blockAt(0)], MARKER, "control: fresh path did not paint the first marker");
  // positive control: the already-flagged path is a no-op -- counter, trigger, and row are untouched.
  const g = entry(0, 1, 4); g.routines = STUBS; oracle(g);
  assert.equal(g.mem8[COUNTER], 4, "control: flagged path bumped the counter anyway");
  assert.equal(g.mem8[TRIGGER], 0, "control: flagged path raised the trigger anyway");
  assert.equal(g.mem8[blockAt(0)], SENT, "control: flagged path repainted the row anyway");
  console.log("  EQUAL: loc_229c == oracle (RAM), fresh p0/p1, flagged no-op, active drop/empty");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const ignoreGuard = (m) => {                       // sets+paints even when the slot is already flagged
    const x = m.mem8; const f = FLAG0 + x[PLAYER];
    x[f] = 1; x[TRIGGER] = 1; x[COUNTER]++; drawMarkerRow(m, x[COUNTER]);
  };
  const forgetCounter = (m) => {                     // flags + trigger + paints, but never bumps the counter
    const x = m.mem8; const f = FLAG0 + x[PLAYER];
    x[f] = 1; x[TRIGGER] = 1; drawMarkerRow(m, x[COUNTER]);
  };
  // a mutant either diverges (ramDiff truthy) or drives a bad count that walks a draw out of bounds and
  // throws -- both mean the mutant is CAUGHT; only a mutant matching the oracle (false, no throw) escapes.
  const caught = (mut, e) => { try { return ramDiff(oracle, mut, e); } catch { return true; } };
  assert.ok(caught(noOp, entry(0, 0, 0)), "the no-op twin escaped (fresh path)");
  assert.ok(caught(ignoreGuard, entry(0, 1, 4)), "the ignore-the-guard twin escaped (flagged path)");
  assert.ok(caught(forgetCounter, entry(0, 0, 0)), "the forget-the-counter twin escaped (fresh path)");
  console.log("  TEETH: no-op, ignore-guard, forget-counter all caught");
});

test("SP-SEAM TOOTH: the stack-neutral body places at the dispatch seam", { skip }, () => {
  for (const [name, e] of [["fresh", entry(0, 0, 0)], ["flagged", entry(0, 1, 4)]]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x229c, e);
    assert.equal(r.placeable, true, `${name}: seam refused the stack-neutral body: ${r.error}`);
  }
  const popping = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, popping, 0x229c, entry(0, 0, 0));
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral body places on the fresh + flagged paths; stack-adrift mutant refused");
});
