// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_023f — memory-equivalent to the frozen oracle at ROM 0x023f. A sequence-state handler: four per-frame
 * subsystem updates, then a two-phase countdown on the 0x4008/0x4009 timer pair (phase-1 reload + descriptor
 * activation + column-count bump on the 0x4008 expiry; phase-2 reload + state advance + 0x4058 clear on the
 * 0x4009 expiry). Live-out is MEMORY only: the handler rets into 0x03d7, which reloads A fresh from 0x4002,
 * so no register survives as an interface. The four subsystems and the object dispatch run identically on
 * both sides (shared STUBS), so ramDiff isolates 023f's own timer writes, which land AFTER the subsystems.
 * Three paths: phase-1 counting, phase-1 expiry / phase-2 counting, both expiry. Teeth: no-op, subsystems-
 * only (skips the countdown), and a wrong reload / wrong state-advance / wrong clear.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_023f as cand } from "../loc_023f.js";
import { loc_023f as oracle } from "../../translated/loc_023f.js";
import { clearStridedTable } from "../clearStridedTable.js";
import { stageObjectsToSpriteShadow } from "../stageObjectsToSpriteShadow.js";
import { loc_0cc3 } from "../loc_0cc3.js";
import { redrawTileColumnsPeriodically } from "../redrawTileColumnsPeriodically.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const T8 = 0x4008;   // phase-1 sub-timer
const T9 = 0x4009;   // phase-2 dwell timer
const STATE = 0x400a;
const SCRATCH = 0x4058;
const COLS = 0x4241; // DRAWN_COLUMN_COUNT
const RELOAD = 0xd2;
const OBJ_BASE = 0x42b0;

// A fresh seed with the two timer bytes poked, the 8 object slots zeroed (so the object dispatcher rets
// immediately — 0x0cd6's own behaviour is exercised by equivalence-0cc3, not here — keeping the descriptor
// write region clean), and a return word seated for the oracle's ret.
function seed(t8, t9) {
  return craft((mem, m) => {
    m.push16(0x9999);
    for (let a = OBJ_BASE; a <= 0x43af; a++) mem[a] = 0;
    mem[T8] = t8;
    mem[T9] = t9;
  });
}

// Just the four subsystem updates (no countdown) — isolates 023f's timer contribution.
function subsysOnly(m) {
  clearStridedTable(m);
  stageObjectsToSpriteShadow(m);
  loc_0cc3(m);
  redrawTileColumnsPeriodically(m);
}

test("EQUAL (crafted): loc_023f == oracle on all three countdown paths", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, seed(5, 3)), null, "phase-1 counting path diverged");
  assert.equal(ramDiff(oracle, cand, seed(1, 4)), null, "phase-1 expiry / phase-2 counting path diverged");
  assert.equal(ramDiff(oracle, cand, seed(1, 1)), null, "both-expiry path diverged");
  console.log("  EQUAL: loc_023f == oracle across phase-1 count, phase-2 count, both-expiry");
});

test("POSITIVE CONTROL: the oracle drives the timer as specified", { skip }, () => {
  // Phase-1 counting: 0x4008 decremented exactly once beyond the subsystems' own effect.
  const a1 = seed(5, 3); oracle(a1);
  const s1 = seed(5, 3); subsysOnly(s1);
  assert.equal(a1.mem8[T8], (s1.mem8[T8] - 1) & 0xff, "phase-1 sub-timer not decremented");
  assert.equal(a1.mem8[STATE], s1.mem8[STATE], "phase-1 path must not advance the state");

  // Phase-1 expiry: sub-timer reloaded; phase-2 timer decremented (still counting).
  const a2 = seed(1, 4); oracle(a2);
  assert.equal(a2.mem8[T8], RELOAD, "phase-1 expiry did not reload the sub-timer");
  assert.equal(a2.mem8[T9], 3, "phase-2 timer not decremented on phase-1 expiry");

  // Both expiry: both reloaded, state advanced, scratch cleared.
  const a3 = seed(1, 1); oracle(a3);
  const s3 = seed(1, 1); subsysOnly(s3);
  assert.equal(a3.mem8[T8], RELOAD, "both-expiry did not reload the sub-timer");
  assert.equal(a3.mem8[T9], RELOAD, "both-expiry did not reload the dwell timer");
  assert.equal(a3.mem8[STATE], (s3.mem8[STATE] + 1) & 0xff, "both-expiry did not advance the state");
  assert.equal(a3.mem8[SCRATCH], 0, "both-expiry did not clear 0x4058");
  console.log("  POSITIVE: phase-1 dec, phase-1 reload+phase-2 dec, both reload + state++ + clear");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongReload = (m) => { cand(m); m.mem8[T8] = 0xff; };            // wrong phase-1 reload const
  const wrongState = (m) => { cand(m); m.mem8[STATE] = (m.mem8[STATE] + 1) & 0xff; }; // extra advance
  const wrongClear = (m) => { cand(m); m.mem8[SCRATCH] = 1; };           // failed to clear 0x4058
  const wrongCols = (m) => { cand(m); m.mem8[COLS] = (m.mem8[COLS] - 1) & 0xff; }; // missed the bump

  assert.ok(ramDiff(oracle, noOp, seed(5, 3)), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, subsysOnly, seed(5, 3)), "the subsystems-only twin escaped (no countdown)");
  assert.ok(ramDiff(oracle, wrongReload, seed(1, 1)), "the wrong-reload twin escaped");
  assert.ok(ramDiff(oracle, wrongState, seed(1, 1)), "the wrong-state twin escaped");
  assert.ok(ramDiff(oracle, wrongClear, seed(1, 1)), "the wrong-clear twin escaped");
  assert.ok(ramDiff(oracle, wrongCols, seed(1, 1)), "the wrong-column-count twin escaped");
  console.log("  TEETH: no-op, subsystems-only, wrong-reload/state/clear/column-count all caught");
});
