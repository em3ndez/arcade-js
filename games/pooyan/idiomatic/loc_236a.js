// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { deriveStackedSpriteYs } from "./deriveStackedSpriteYs.js";
import { advanceTileAnimForwardOnOdd } from "./advanceTileAnimForwardOnOdd.js";
import { loc_23a1 } from "./loc_23a1.js";
import { TILE_ANIM_CURSOR, TAMPER_STRIKES_SIG, loc_8083, loc_8343 } from "./names.js";
/**
 * loc_236a — descent half of the direction-split actor handler at IX.
 *
 * Runs only while aim bit 3 is set. Steps the actor's vertical position one toward the
 * floor (increment), clamps it at the low-screen limit, then refreshes the three stacked
 * sprite Ys. Once the animation cursor's low byte reaches its end marker the shared render
 * tail runs only while a tamper strike is recorded or the colour-parity sum is nonzero;
 * with nothing armed the handler holds and the display freezes.
 *
 * LIVE-OUT: none — a void handler; the caller reads nothing back.
 */
const OFF_POS_Y = 0x04; //     (IX+4) actor vertical position
const OFF_AIM_FLAGS = 0x07; // (IX+7) aim/direction flags
const ACTIVE_BIT = 0x08; //    aim bit 3: descent runs only while set
const POS_FLOOR = 0xc0; //     high clamp for the descent position
const CURSOR_END = 0xf6; //    cursor low byte marking the script's end
const TAMPER_SIG_LEN = 3; //   tamper-strike cells scanned before the tail
const PARITY_MASK = 0x0f; //   low nibble of the colour-parity sum

export function loc_236a(m, actor = m.regs.ix) {
  const { mem8 } = m;

  if ((mem8[actor + OFF_AIM_FLAGS] & ACTIVE_BIT) === 0) return; // inactive -> hold

  const y = u8(mem8[actor + OFF_POS_Y] + 1);
  mem8[actor + OFF_POS_Y] = y;
  if (y >= POS_FLOOR) mem8[actor + OFF_POS_Y] = POS_FLOOR; // clamp at the floor
  deriveStackedSpriteYs(m);

  if (mem8[TILE_ANIM_CURSOR] === CURSOR_END) {
    let armed = false;
    for (let i = 0; i < TAMPER_SIG_LEN; i++) {
      if (mem8[TAMPER_STRIKES_SIG + i] !== 0) { armed = true; break; }
    }
    if (!armed) {
      const parity = (mem8[loc_8343] + mem8[loc_8083]) & PARITY_MASK;
      if (parity === 0) return; // nothing armed -> hold, no render
    }
  }

  advanceTileAnimForwardOnOdd(m); // advance the tile-anim script
  return loc_23a1(m); //            shared render tail
}
