// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_20ac — crafted-entry equivalence vs the frozen player-status paint at ROM 0x20ac.
 * Memory-only live-out (VRAM tilemap cells, plus a possible clear of the status flag 0x40ab); registers
 * are dead. ramDiff (return-stack masked) is the whole check. Three paths off B bit 4 and the paired-player
 * flag 0x400e:
 *   - B bit4 clear: paint the active player's 3-cell column, and (gate 0x4006==0) clear 0x40ab.
 *   - B bit4 set, 0x400e!=0: blank the active column, then paint the other player's column.
 *   - B bit4 set, 0x400e==0: blank the active column only; the other column is left untouched.
 * Teeth: no-op, wrong-tile, skip-clear, and ignore-two-player twins each diverge.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { repaintPlayerStatusColumn as cand } from "../repaintPlayerStatusColumn.js";
import { loc_20ac as oracle } from "../../translated/loc_20ac.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const CURRENT_PLAYER = 0x400d;
const PAIRED_FLAG = 0x400e;
const GATE = 0x4006; // when 0 (and bit4 clear), the paint clears the status flag
const STATUS_FLAG = 0x40ab;
const P1_COL = 0x5340; // player-0 status column base
const P2_COL = 0x50e0; // player-1 status column base
const STRIDE = 0x20; // rows step up by 0x20

// Player 0, B bit 4 clear, gate open: paint the active column and clear the status flag.
const paintActive = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.b = 0x00;
  mem[CURRENT_PLAYER] = 0;
  mem[GATE] = 0;
  mem[STATUS_FLAG] = 0x99;
});

// Player 0, B bit 4 set, paired flag set: blank the active column, paint the other (player-1) column.
const twoPlayer = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.b = 0x10;
  mem[CURRENT_PLAYER] = 0;
  mem[PAIRED_FLAG] = 1;
  mem[P2_COL] = 0x99; // sentinel so the alternate paint is observable
});

// Player 0, B bit 4 set, paired flag clear: blank the active column only.
const onePlayer = () => craft((mem, mm) => {
  mm.push16(0x9999);
  mm.regs.b = 0x10;
  mem[CURRENT_PLAYER] = 0;
  mem[PAIRED_FLAG] = 0;
  mem[P2_COL] = 0x99; // must stay 0x99 (no alternate paint)
});

test("EQUAL (crafted): loc_20ac == oracle, paint the active column", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, paintActive()), null, "loc_20ac diverged painting the active column");
  const a = paintActive(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[P1_COL], 1, "positive control: top cell = player+1");
  assert.equal(a.mem8[P1_COL - STRIDE], 0x25, "positive control: middle tile");
  assert.equal(a.mem8[P1_COL - 2 * STRIDE], 0x20, "positive control: bottom tile");
  assert.equal(a.mem8[STATUS_FLAG], 0, "positive control: status flag cleared");
  console.log("  EQUAL: active column painted, status flag cleared");
});

test("EQUAL (crafted): loc_20ac == oracle, two-player blank-then-alternate", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, twoPlayer()), null, "loc_20ac diverged on the two-player path");
  const a = twoPlayer(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[P1_COL], 16, "positive control: active column blanked");
  assert.equal(a.mem8[P2_COL], 2, "positive control: other column top cell = other+1");
  console.log("  EQUAL: active blanked, other column painted");
});

test("EQUAL (crafted): loc_20ac == oracle, one-player blank only", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, onePlayer()), null, "loc_20ac diverged on the one-player path");
  const a = onePlayer(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[P1_COL], 16, "positive control: active column blanked");
  assert.equal(a.mem8[P2_COL], 0x99, "positive control: other column untouched");
  console.log("  EQUAL: active blanked, other column untouched");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongTile = (m) => { cand(m); m.mem8[P1_COL] = 0x99; }; // paints, then corrupts the top cell
  const skipClear = (m) => { cand(m); m.mem8[STATUS_FLAG] = 0x99; }; // paints then leaves the flag set
  const ignoreTwoPlayer = (m) => { m.mem8[P1_COL] = 16; m.mem8[P1_COL - STRIDE] = 16; m.mem8[P1_COL - 2 * STRIDE] = 16; };
  assert.ok(ramDiff(oracle, noOp, paintActive()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongTile, paintActive()), "wrong-tile twin escaped");
  assert.ok(ramDiff(oracle, skipClear, paintActive()), "skip-clear twin escaped");
  assert.ok(ramDiff(oracle, ignoreTwoPlayer, twoPlayer()), "ignore-two-player twin escaped");
  console.log("  TEETH: no-op, wrong-tile, skip-clear, ignore-two-player all caught");
});
