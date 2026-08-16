// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampHomeGoalAndResetFrog — memory-equivalent to the frozen oracle loc_1f1c (ROM 0x1F1C), the
 * shared home-goal fill and frog reset. GATE: crafted-entry with HL armed to a home slot. The
 * candidate dissolves the BCD score add (0x08e0), the sound enqueue (0x0018), and the work-RAM clear
 * (0x07e6), and keeps the m.call into the still-translated collision clear (0x27bc) and score-display
 * refresh (0x08c5). Covered: no-collision vs latched-collision entry; attract (skips fanfare) vs play;
 * the fanfare-pointer path and the fourth-home board clear; and player-1 vs player-2 count cells. RAM
 * compared, stack masked. Teeth: no-op, skipped reset, wrong parked Y; positive control the frog Y
 * parks at 0xf0.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, FROG_Y } from "./_frogHop.js";
import { stampHomeGoalAndResetFrog as cand } from "../stampHomeGoalAndResetFrog.js";
import { loc_1f1c as oracle } from "../../translated/loc_1f1c.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const SLOT = 0xaaa4;
const COLLISION = 0x8134, PLAY = 0x83fe, PLAYER = 0x83fd;
const COUNT_P1 = 0x825c, COUNT_P2 = 0x825d, FANFARE_IDX = 0x8381, RESET_GATE = 0x826c;

const base = (mem, mc) => {
  mc.regs.hl = SLOT;
  mem[FROG_Y] = 0x50; mem[RESET_GATE] = 0; mem[FANFARE_IDX] = 0x05;
};
const attractClean = () => craft((mem, mc) => { base(mem, mc); mem[COLLISION] = 0; mem[PLAY] = 0; });
const attractCollision = () => craft((mem, mc) => { base(mem, mc); mem[COLLISION] = 1; mem[PLAY] = 0; });
const playFanfare = () => craft((mem, mc) => { base(mem, mc); mem[COLLISION] = 0; mem[PLAY] = 1; mem[PLAYER] = 1; mem[COUNT_P1] = 1; });
const playBoardClear = () => craft((mem, mc) => { base(mem, mc); mem[COLLISION] = 0; mem[PLAY] = 2; mem[PLAYER] = 1; mem[COUNT_P1] = 4; });
const playPlayer2 = () => craft((mem, mc) => { base(mem, mc); mem[COLLISION] = 0; mem[PLAY] = 2; mem[PLAYER] = 2; mem[COUNT_P2] = 2; });

test("EQUAL (crafted): stampHomeGoalAndResetFrog == oracle over every branch", { skip }, () => {
  for (const [name, mk] of [
    ["attract-clean", attractClean], ["attract-collision", attractCollision],
    ["play-fanfare", playFanfare], ["play-board-clear", playBoardClear], ["play-player2", playPlayer2],
  ]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  const e = attractClean(); const a = e.clone(); oracle(a);
  assert.equal(a.mem8[FROG_Y], 0xf0, "positive control: the frog Y was not parked at 0xf0");
  console.log("  EQUAL: attract-clean/collision, play fanfare/board-clear/player2; frog Y parked 0xf0");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipReset = (m) => { cand(m); m.mem8[RESET_GATE] = 0; };
  const wrongParkY = (m) => { cand(m); m.mem8[FROG_Y] = 0; };
  assert.ok(ramDiff(oracle, noOp, attractClean()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, skipReset, attractClean()), "skipped-reset twin escaped");
  assert.ok(ramDiff(oracle, wrongParkY, attractClean()), "wrong-park-Y twin escaped");
  console.log("  TEETH: no-op, skipped-reset, wrong-park-Y all caught");
});
