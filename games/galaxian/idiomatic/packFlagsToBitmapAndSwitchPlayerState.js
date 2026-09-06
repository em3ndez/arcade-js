// SPDX-License-Identifier: GPL-3.0-only
// Dispatch state: tick the dwell timer and stay here until it expires. On expiry, clear the sequence
// state and two status flags, pack the flag bytes into the packed bitmap, copy an 8-byte template
// just after it, mark the current player, and advance the game state.
import { packFlagBytesToBitmask } from "./packFlagBytesToBitmask.js";
import {
  loc_4009,
  SEQUENCE_STATE,
  loc_4222,
  loc_422b,
  PACKED_FLAG_BITMAP,
  loc_4218,
  CURRENT_PLAYER,
  GAME_STATE,
} from "./names.js";

const TEMPLATE_BYTES = 8;
const NEXT_STATE = 4;

export function packFlagsToBitmapAndSwitchPlayerState(m) {
  const { mem8 } = m;

  // Countdown; stay in this state until it reaches zero.
  const remaining = (mem8[loc_4009] - 1) & 0xff;
  mem8[loc_4009] = remaining;
  if (remaining !== 0) return;

  mem8[SEQUENCE_STATE] = 0;
  mem8[loc_4222] = 0;
  mem8[loc_422b] = 0;

  // Pack the flag bytes into the bitmap; the returned pointer is where the template copy lands.
  const dst = packFlagBytesToBitmask(m, PACKED_FLAG_BITMAP);
  for (let i = 0; i < TEMPLATE_BYTES; i++) mem8[dst + i] = mem8[loc_4218 + i];

  mem8[CURRENT_PLAYER] = 1;
  mem8[GAME_STATE] = NEXT_STATE;
}
