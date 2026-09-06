// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_028e — memory-equivalent to the frozen oracle at ROM 0x028e. A sequence-state handler: four per-frame
 * subsystem updates, then a tail-jump into 0x0336 (tickPrescaledSequenceTimer) — dissolved here to a direct
 * call — which ticks the prescaled sub-timer (0x4008) and, on its wrap, reloads it to 60 and cascades a tick
 * into the dwell tier (0x4009 -> carry into SEQUENCE_STATE 0x400a). Live-out is MEMORY only (the handler
 * rets into 0x03d7, which reloads A fresh from 0x4002). The subsystems never touch 0x4008/0x4009/0x400a, so
 * the seed's poked timer bytes fully determine the path; the object slots are zeroed so the dispatcher is
 * inert (0x0cd6's behaviour is exercised by equivalence-0cc3).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { loc_028e as cand } from "../loc_028e.js";
import { loc_028e as oracle } from "../../translated/loc_028e.js";
import { clearStridedTable } from "../clearStridedTable.js";
import { stageObjectsToSpriteShadow } from "../stageObjectsToSpriteShadow.js";
import { loc_0cc3 } from "../loc_0cc3.js";
import { redrawTileColumnsPeriodically } from "../redrawTileColumnsPeriodically.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const T8 = 0x4008;   // prescaled sub-timer
const T9 = 0x4009;   // dwell tier
const STATE = 0x400a;
const OBJ_BASE = 0x42b0;
const SUBTIMER_RELOAD = 60; // 0x3c

function seed(t8, t9) {
  return craft((mem, m) => {
    m.push16(0x9999);
    for (let a = OBJ_BASE; a <= 0x43af; a++) mem[a] = 0;
    mem[T8] = t8;
    mem[T9] = t9;
  });
}

function subsysOnly(m) {
  clearStridedTable(m);
  stageObjectsToSpriteShadow(m);
  loc_0cc3(m);
  redrawTileColumnsPeriodically(m);
}

test("EQUAL (crafted): loc_028e == oracle on the sub-timer paths", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, seed(5, 7)), null, "sub-timer counting path diverged");
  assert.equal(ramDiff(oracle, cand, seed(1, 5)), null, "sub-timer wrap / dwell counting path diverged");
  assert.equal(ramDiff(oracle, cand, seed(1, 1)), null, "sub-timer wrap / dwell expiry path diverged");
  console.log("  EQUAL: loc_028e == oracle across counting, sub-timer wrap, dwell carry");
});

test("POSITIVE CONTROL: the oracle ticks the prescaled cascade", { skip }, () => {
  // Counting: sub-timer decremented, dwell + state untouched.
  const c = seed(5, 7); oracle(c);
  assert.equal(c.mem8[T8], 4, "sub-timer not decremented while counting");
  assert.equal(c.mem8[T9], 7, "dwell tier must not tick while the sub-timer counts");

  // Sub-timer wrap, dwell counting: sub-timer reloaded to 60, dwell decremented.
  const w = seed(1, 5); oracle(w);
  assert.equal(w.mem8[T8], SUBTIMER_RELOAD, "sub-timer not reloaded on wrap");
  assert.equal(w.mem8[T9], 4, "dwell tier not decremented on sub-timer wrap");

  // Dwell expiry: sub-timer reloaded, dwell hits 0, state carried up one.
  const e = seed(1, 1); oracle(e);
  const s = seed(1, 1); subsysOnly(s);
  assert.equal(e.mem8[T8], SUBTIMER_RELOAD, "sub-timer not reloaded on dwell expiry");
  assert.equal(e.mem8[T9], 0, "dwell tier did not reach zero");
  assert.equal(e.mem8[STATE], (s.mem8[STATE] + 1) & 0xff, "state not carried up on dwell expiry");
  console.log("  POSITIVE: dec, wrap->reload+dwell dec, dwell expiry->state carry");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongReload = (m) => { cand(m); m.mem8[T8] = 0; };                // wrong sub-timer reload
  const wrongDwell = (m) => { cand(m); m.mem8[T9] = (m.mem8[T9] + 1) & 0xff; };
  const wrongState = (m) => { cand(m); m.mem8[STATE] = (m.mem8[STATE] + 1) & 0xff; };

  assert.ok(ramDiff(oracle, noOp, seed(5, 7)), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, subsysOnly, seed(5, 7)), "the subsystems-only twin escaped (no tick)");
  assert.ok(ramDiff(oracle, wrongReload, seed(1, 5)), "the wrong-reload twin escaped");
  assert.ok(ramDiff(oracle, wrongDwell, seed(1, 5)), "the wrong-dwell twin escaped");
  assert.ok(ramDiff(oracle, wrongState, seed(1, 1)), "the wrong-state twin escaped");
  console.log("  TEETH: no-op, subsystems-only, wrong-reload, wrong-dwell, wrong-state all caught");
});
