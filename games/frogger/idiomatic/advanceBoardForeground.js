// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceBoardForeground — the board-advance foreground pass: queue two sound cues, bump the active
 * player's mod-5 difficulty index (wrapping to 0 at 5), reseed the score field and lay out the new
 * board, raise the board-laid-out flag, then tail into the score adder with the board-advance delta.
 * LIVE-OUT: memory-only.
 */
import { ACTIVE_PLAYER, loc_8293, loc_8294, loc_8380 } from "./names.js";
import { enqueueSoundCommand } from "./enqueueSoundCommand.js";
import { clearAndSeedScoreField } from "./clearAndSeedScoreField.js";
import { clearObjectBlocksAndMirrorToObjRam } from "./clearObjectBlocksAndMirrorToObjRam.js";
import { loadActivePlayerLaneParams } from "./loadActivePlayerLaneParams.js";
import { seedObjectAnimationState } from "./seedObjectAnimationState.js";
import { addScoreAndAwardExtraLife } from "./addScoreAndAwardExtraLife.js";

const MOD5_WRAP = 5;

export function advanceBoardForeground(m) {
  const { regs, mem8 } = m;

  regs.a = 0x10; enqueueSoundCommand(m);
  regs.a = 0x30; enqueueSoundCommand(m);

  const cell = mem8[ACTIVE_PLAYER] === 1 ? loc_8293 : loc_8294;
  let v = (mem8[cell] + 1) & 0xff;
  if (v === MOD5_WRAP) v = 0;
  mem8[cell] = v;

  clearAndSeedScoreField(m);
  clearObjectBlocksAndMirrorToObjRam(m);
  loadActivePlayerLaneParams(m);
  seedObjectAnimationState(m);

  mem8[loc_8380] = 1;
  regs.de = 0x0100;
  return addScoreAndAwardExtraLife(m);
}
