// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderStageCountdownDigits — paint the stage countdown as a two-cell HUD number.
 *
 * Reads STAGE_COUNTDOWN and writes its units nibble to the low HUD tile and its tens
 * nibble one tilemap row over, suppressing a leading zero. A value below ten renders as a
 * single digit as-is; a value of ten or more converts to packed BCD first (and only that
 * path is gated: it draws nothing while PLAY_MODE_LATCH is held). Calls nothing.
 *
 * LIVE-OUT: memory only (at most two HUD tiles); no register or flag survives for a caller.
 */
import { binToPackedBcd } from "./binToPackedBcd.js";
import { STAGE_COUNTDOWN, PLAY_MODE_LATCH, HUD_STAGE_DIGIT_LO } from "./names.js";

const SINGLE_DIGIT_LIMIT = 0x0a; // below ten: one digit, drawn without BCD conversion
const TENS_ROW_STRIDE = 0x20; //    the tens tile sits one tilemap row past the units tile

export function renderStageCountdownDigits(m) {
  const { mem8 } = m;

  let value = mem8[STAGE_COUNTDOWN];
  if (value >= SINGLE_DIGIT_LIMIT) {
    if (mem8[PLAY_MODE_LATCH] !== 0) return; // gated while the play-mode latch is held
    value = binToPackedBcd(m, value).a; //     two-digit values render in packed BCD
  }

  mem8[HUD_STAGE_DIGIT_LO] = value & 0x0f; // units nibble (always drawn)
  const tens = (value >> 4) & 0x0f;
  if (tens === 0) return; // leading-zero suppression
  mem8[HUD_STAGE_DIGIT_LO + TENS_ROW_STRIDE] = tens;
}
