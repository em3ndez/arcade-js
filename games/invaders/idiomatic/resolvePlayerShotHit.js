// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { clearShotHitAndSilence } from "./clearShotHitAndSilence.js";
import { markSaucerHitAndRetireShot } from "./markSaucerHitAndRetireShot.js";
import { scaleXToBlock } from "./scaleXToBlock.js";
import { scaleYToBlock } from "./scaleYToBlock.js";
import { alienGridCellPtr } from "./alienGridCellPtr.js";
import { queueInvaderKillScore } from "./queueInvaderKillScore.js";
import { loadSpriteDescriptor } from "./loadSpriteDescriptor.js";
import { blitShiftedSprite } from "./blitShiftedSprite.js";
import { PLAYER_SHOT_STATUS, PLAYER_SHOT_HIT, loc_2009, loc_2029, loc_202a, ALIEN_EXPLOSION_ADDR, ALIEN_EXPLOSION_TIMER } from "./names.js";

// Resolve a player-shot collision while in state 2: ret unless a hit is latched; bounds-check the shot Y,
// scale the coords to a 55-cell alien-rack index (stashed for the despawn), and on a live cell kill the
// alien + queue its explosion (enter state 5, blit, arm the despawn timer); otherwise stand the shot down,
// or in the saucer altitude band mark the saucer hit and retire the shot.
export function resolvePlayerShotHit(m) {
  const standDown = () => {
    m.mem8[PLAYER_SHOT_STATUS] = 0x03;
    return clearShotHitAndSilence(m);
  };

  const state = m.mem8[PLAYER_SHOT_STATUS];
  if (state === 0x05) return;
  if (state !== 0x02) return;

  const coord = m.mem8[loc_2029];
  if (coord >= 0xd8) return standDown();
  if (m.mem8[PLAYER_SHOT_HIT] === 0) return;
  if (coord >= 0xce) return markSaucerHitAndRetireShot(m);

  const key = u8(coord + 0x06);
  const gate = m.mem8[loc_2009];
  if (gate < 0x90 && gate >= key) return standDown();

  const [, residualX, xBlock] = scaleXToBlock(m, key);
  const [, residualY] = scaleYToBlock(m, m.mem8[loc_202a]);
  m.mem16[ALIEN_EXPLOSION_ADDR] = (residualY << 8) | residualX;
  m.mem8[PLAYER_SHOT_STATUS] = 0x05;

  const recPtr = alienGridCellPtr(m, xBlock);
  if (m.mem8[recPtr] === 0) return standDown();
  m.mem8[recPtr] = 0x00;

  loadSpriteDescriptor(m, queueInvaderKillScore(m, xBlock));
  blitShiftedSprite(m);
  m.mem8[ALIEN_EXPLOSION_TIMER] = 0x10;
}
