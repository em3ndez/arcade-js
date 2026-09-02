// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { deactivatePrize } from "./deactivatePrize.js";
import { markExitingAndRetire } from "./markExitingAndRetire.js";
import { scaleXToBlock } from "./scaleXToBlock.js";
import { scaleYToBlock } from "./scaleYToBlock.js";
import { loc_1581 } from "./loc_1581.js";
import { loc_0a5f } from "./loc_0a5f.js";
import { loadSpriteDescriptor } from "./loadSpriteDescriptor.js";
import { blitShiftedSprite } from "./blitShiftedSprite.js";
import { PLAYER_SHOT_STATUS, PRIZE_ACTIVE, loc_2009, loc_2029, loc_202a, loc_2064, loc_2003 } from "./names.js";

// Commit a landed prize while in state 2: bounds-check its descent, scale the descriptor coords to grid
// blocks (stashed for the despawn), enter state 5, and if the target cell is set blit the prize and arm its
// timer; otherwise stand the prize down.
export function loc_14d8(m) {
  const standDown = () => {
    m.mem8[PLAYER_SHOT_STATUS] = 0x03;
    return deactivatePrize(m);
  };

  const state = m.mem8[PLAYER_SHOT_STATUS];
  if (state === 0x05) return;
  if (state !== 0x02) return;

  const coord = m.mem8[loc_2029];
  if (coord >= 0xd8) return standDown();
  if (m.mem8[PRIZE_ACTIVE] === 0) return;
  if (coord >= 0xce) return markExitingAndRetire(m);

  const key = u8(coord + 0x06);
  const gate = m.mem8[loc_2009];
  if (gate < 0x90 && gate >= key) return standDown();

  const [, residualX, xBlock] = scaleXToBlock(m, key);
  const [, residualY] = scaleYToBlock(m, m.mem8[loc_202a]);
  m.mem16[loc_2064] = (residualY << 8) | residualX;
  m.mem8[PLAYER_SHOT_STATUS] = 0x05;

  const recPtr = loc_1581(m, xBlock);
  if (m.mem8[recPtr] === 0) return standDown();
  m.mem8[recPtr] = 0x00;

  loadSpriteDescriptor(m, loc_0a5f(m, xBlock));
  blitShiftedSprite(m);
  m.mem8[loc_2003] = 0x10;
}
