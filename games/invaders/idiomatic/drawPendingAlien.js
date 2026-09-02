// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { PLAYER_SHOT_HIT, ACTIVE_PLAYER_PAGE, loc_2004, loc_2005, ALIEN_DRAW_INDEX, ALIEN_SPRITE_TABLE, ALIEN_DRAW_ADDR, ALIEN_DRAW_PENDING } from "./names.js";
import { tickAlienExplosionDespawn } from "./tickAlienExplosionDespawn.js";
import { selectAlternateSpriteFrame } from "./selectAlternateSpriteFrame.js";
import { blitShiftedSprite } from "./blitShiftedSprite.js";

// Redraw the pending sprite object: when it is already despawning, tick that instead; otherwise, if its
// slot is live, assemble the (optionally alternate-frame) sprite pointer and shift-blit it at the pending
// draw address. Every non-despawn case clears the draw-pending flag (safely before the disjoint blit).
export function drawPendingAlien(m) {
  if (m.mem8[PLAYER_SHOT_HIT] !== 0) return tickAlienExplosionDespawn(m);
  const objAddr = (m.mem8[ACTIVE_PLAYER_PAGE] << 8) | m.mem8[ALIEN_DRAW_INDEX];
  if (m.mem8[objAddr] !== 0) {
    const even = m.mem8[loc_2004] & 0xfe;
    let sprite = ALIEN_SPRITE_TABLE + u8((even << 3) | (even >>> 5)); // sprite id -> rotate-left-3 -> table offset
    if (m.mem8[loc_2005] !== 0) sprite = selectAlternateSpriteFrame(m, sprite);
    m.mem8[ALIEN_DRAW_PENDING] = 0;
    return ((m.regs.hl = m.mem16[ALIEN_DRAW_ADDR]), blitShiftedSprite(m, sprite, 0x10));
  }
  m.mem8[ALIEN_DRAW_PENDING] = 0;
}
