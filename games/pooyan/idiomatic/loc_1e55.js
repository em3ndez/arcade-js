// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  BOARD_CLEAR_FLAG,
  TAMPER_OBJECT_FREEZE_FLAG,
  GAME_ACTIVE_FLAG,
  LEAD_ACTOR_STATE,
  WAVE_TEARDOWN_STATE,
  SECONDARY_TEARDOWN_FLAG,
  FLIP_SCREEN_FLAG,
  IN1_PORT,
  IN2_PORT,
  PLAYER_AIM_FLAGS,
  INPUT_ROTATE_LATCH,
} from "./names.js";
/**
 * loc_1e55 — sample the joystick into the player-actor state byte each frame.
 *
 * If any freeze/abort flag is set it zeroes the state byte and leaves. While the game is
 * inactive it does nothing. Otherwise it reads the live joystick (player 1 upright, player 2
 * when the screen is flipped), stores its complement as the state byte, and rotates the
 * complement's bit 4 into a shift latch. When the latch's low three bits are not exactly 1
 * it also clears the state byte's bit 4.
 *
 * LIVE-OUT: memory only — the player-actor state byte and the shift latch. Registers are
 * scratch; no caller consumes them.
 */
const AIM_BIT4 = 0x10;

export function loc_1e55(m) {
  const { mem8 } = m;

  if (mem8[BOARD_CLEAR_FLAG] !== 0 || mem8[TAMPER_OBJECT_FREEZE_FLAG] !== 0) {
    mem8[PLAYER_AIM_FLAGS] = 0;
    return;
  }
  if (mem8[GAME_ACTIVE_FLAG] === 0) return;
  if (mem8[LEAD_ACTOR_STATE] !== 0) {
    mem8[PLAYER_AIM_FLAGS] = 0;
    return;
  }
  if ((mem8[WAVE_TEARDOWN_STATE] | mem8[SECONDARY_TEARDOWN_FLAG]) !== 0) {
    mem8[PLAYER_AIM_FLAGS] = 0;
    return;
  }

  const input = mem8[FLIP_SCREEN_FLAG] !== 0 ? mem8[IN1_PORT] : mem8[IN2_PORT];
  const aim = u8(~input);
  mem8[PLAYER_AIM_FLAGS] = aim;

  // Four left-rotations move the complement's bit 4 into the carry; that bit shifts into
  // the latch's bit 0.
  const topBit = (aim >> 4) & 1;
  const latch = u8((mem8[INPUT_ROTATE_LATCH] << 1) | topBit);
  mem8[INPUT_ROTATE_LATCH] = latch;

  if ((latch & 0x07) === 1) return;
  mem8[PLAYER_AIM_FLAGS] = aim & ~AIM_BIT4;
}
