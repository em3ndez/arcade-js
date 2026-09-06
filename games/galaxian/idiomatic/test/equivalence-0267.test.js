// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0267 — memory-equivalent to the frozen oracle at ROM 0x0267. A sequence-state handler: four per-frame
 * subsystem updates, then a countdown on the 0x4009 dwell timer. While counting, done. On expiry: advance
 * SEQUENCE_STATE (0x400a), clear 0x4058, install the pointer word 0x1140 into the 0x4008/0x4009 pair, bump
 * DRAWN_COLUMN_COUNT (0x4241), and enqueue command word 0x060f (channel 6, arg 0x0f) — the ROM tail-jumps
 * into 0x08f2 (enqueueCommandWord), dissolved here to a direct call. Live-out is MEMORY only (the handler
 * rets into 0x03d7, which reloads A fresh from 0x4002). The seed zeroes the 8 object slots (so the object
 * dispatcher rets immediately — its own enqueues would otherwise move the command head) and frees the
 * head slot, so the ONLY enqueue observed is 0267's, deterministically.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { queueColumnDrawAndAdvanceSequence as cand } from "../queueColumnDrawAndAdvanceSequence.js";
import { loc_0267 as oracle } from "../../translated/loc_0267.js";
import { clearStridedTable } from "../clearStridedTable.js";
import { stageObjectsToSpriteShadow } from "../stageObjectsToSpriteShadow.js";
import { driveAllObjectSlots } from "../driveAllObjectSlots.js";
import { redrawTileColumnsPeriodically } from "../redrawTileColumnsPeriodically.js";
import { enqueueCommandWord } from "../enqueueCommandWord.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const T8 = 0x4008;
const T9 = 0x4009;      // dwell timer
const STATE = 0x400a;
const SCRATCH = 0x4058;
const COLS = 0x4241;
const OBJ_BASE = 0x42b0;
const HEAD = 0x40a0;    // command-queue write head
const FREE_HEAD = 0xc0; // head index whose slot we free so 0267's enqueue is observable
const SLOT = 0x4000 + FREE_HEAD; // 0x40c0

// A fresh seed: dwell timer poked, object slots zeroed (dispatcher inert), the command head freed at 0xc0,
// and a return word seated for the oracle's ret.
function seed(t9) {
  return craft((mem, m) => {
    m.push16(0x9999);
    for (let a = OBJ_BASE; a <= 0x43af; a++) mem[a] = 0;
    mem[T9] = t9;
    mem[HEAD] = FREE_HEAD;
    mem[SLOT] = 0x80; // bit 7 set == slot free
  });
}

function subsysOnly(m) {
  clearStridedTable(m);
  stageObjectsToSpriteShadow(m);
  driveAllObjectSlots(m);
  redrawTileColumnsPeriodically(m);
}

test("EQUAL (crafted): loc_0267 == oracle on the counting and expiry paths", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, seed(5)), null, "dwell-counting path diverged");
  assert.equal(ramDiff(oracle, cand, seed(1)), null, "dwell-expiry path diverged");
  console.log("  EQUAL: loc_0267 == oracle across dwell-counting and dwell-expiry");
});

test("POSITIVE CONTROL: the oracle drives the expiry as specified", { skip }, () => {
  // Counting: dwell timer decremented exactly once beyond the subsystems.
  const c = seed(5); oracle(c);
  const sc = seed(5); subsysOnly(sc);
  assert.equal(c.mem8[T9], (sc.mem8[T9] - 1) & 0xff, "dwell timer not decremented while counting");
  assert.equal(c.mem8[T8], sc.mem8[T8], "counting path must not install the pointer word");

  // Expiry: state advanced, scratch cleared, pointer word 0x1140 installed, column count bumped, and the
  // command word 0x060f enqueued into the freed head slot with the head committed forward.
  const a = seed(1); oracle(a);
  const s = seed(1); subsysOnly(s);
  assert.equal(a.mem8[STATE], (s.mem8[STATE] + 1) & 0xff, "expiry did not advance the state");
  assert.equal(a.mem8[SCRATCH], 0, "expiry did not clear 0x4058");
  assert.equal(a.mem8[T8], 0x40, "pointer-word low byte (0x1140) not installed at 0x4008");
  assert.equal(a.mem8[T9], 0x11, "pointer-word high byte (0x1140) not installed at 0x4009");
  assert.equal(a.mem8[COLS], (s.mem8[COLS] + 1) & 0xff, "expiry did not bump the column count");
  assert.equal(a.mem8[SLOT], 0x06, "command word hi byte not enqueued");
  assert.equal(a.mem8[SLOT + 1], 0x0f, "command word lo byte not enqueued");
  assert.equal(a.mem8[HEAD], (FREE_HEAD + 2) & 0xff, "command head not advanced/committed");
  console.log("  POSITIVE: state++, clear, ptr 0x1140, col++, cmd 0x060f enqueued + head committed");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongPtrLo = (m) => { cand(m); m.mem8[T8] = 0; };                 // wrong pointer-word low byte
  const wrongPtrHi = (m) => { cand(m); m.mem8[T9] = 0; };                 // wrong pointer-word high byte
  const wrongState = (m) => { cand(m); m.mem8[STATE] = (m.mem8[STATE] + 1) & 0xff; };
  const wrongClear = (m) => { cand(m); m.mem8[SCRATCH] = 1; };
  const wrongCmd = (m) => { cand(m); m.mem8[SLOT + 1] = 0xff; };          // wrong enqueued command word

  assert.ok(ramDiff(oracle, noOp, seed(5)), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, subsysOnly, seed(5)), "the subsystems-only twin escaped (no countdown)");
  assert.ok(ramDiff(oracle, wrongPtrLo, seed(1)), "the wrong-pointer-low twin escaped");
  assert.ok(ramDiff(oracle, wrongPtrHi, seed(1)), "the wrong-pointer-high twin escaped");
  assert.ok(ramDiff(oracle, wrongState, seed(1)), "the wrong-state twin escaped");
  assert.ok(ramDiff(oracle, wrongClear, seed(1)), "the wrong-clear twin escaped");
  assert.ok(ramDiff(oracle, wrongCmd, seed(1)), "the wrong-command-word twin escaped");
  console.log("  TEETH: no-op, subsystems-only, wrong ptr-lo/ptr-hi/state/clear/command all caught");
});
