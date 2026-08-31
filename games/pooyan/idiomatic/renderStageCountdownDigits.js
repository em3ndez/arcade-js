// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderStageCountdownDigits — paint the per-stage countdown as a two-cell HUD number.
 *
 * WHAT IT IS
 *   The stage countdown STAGE_COUNTDOWN (0x8901) is a small counter that starts near 0x20 at the
 *   top of a stage and ticks down as the stage plays out; its value is shown to the player as a
 *   short number in the top-of-screen status readout. This routine is the piece that turns that
 *   one byte into the up-to-two decimal-digit glyphs on screen.
 *
 * ROLE IN THE MACHINE
 *   It is the "countdown digits" leg of the readout-refresh chain that also paints the round
 *   number, the fixed stage label, and the vertical phase gauge. It is driven from the shared
 *   enemy-despawn tail despawnActorAndRenderStageCountdown and from the round/stage HUD refresh,
 *   so the on-screen countdown tracks the live value each time an actor leaves the field.
 *
 * ROM 0x34c9-0x34f1. Grounding: [seen].
 *
 * HOW THE NUMBER IS FORMED
 *   A countdown below ten is a single decimal digit whose binary value already equals the digit,
 *   so it is drawn as-is. A value of ten or more is first converted to packed binary-coded decimal
 *   (tens in the high nibble, units in the low nibble) because the tile glyphs are addressed one
 *   decimal digit per nibble. Only the two-digit path is gated: it abandons the draw while the
 *   play-mode latch is held (an alternate play-mode owns the readout then). The units nibble is
 *   always written; the tens tile, one tilemap row over, is written only when nonzero so a value
 *   below ten shows no leading "0".
 *
 * LIVE-OUT: memory only — at most two HUD tiles in the tilemap (units at HUD_STAGE_DIGIT_LO
 *   0x8743, tens one row over at 0x8763). No register or flag survives for a caller. Calls nothing.
 */
import { binToPackedBcd } from "./binToPackedBcd.js";
import { STAGE_COUNTDOWN, PLAY_MODE_LATCH, HUD_STAGE_DIGIT_LO } from "./names.js";

// Threshold splitting the two render paths: 0..9 is a single digit whose binary value is already
// its own display nibble and needs no conversion; ten or more must be turned into two BCD digits.
const SINGLE_DIGIT_LIMIT = 0x0a; // below ten: one digit, drawn without BCD conversion
// The tilemap is row-major with 0x20 (32) tiles per row, so adding one row's worth of tiles to a
// cell address lands on the cell one row over — where the tens digit of the countdown is drawn.
const TENS_ROW_STRIDE = 0x20; //    the tens tile sits one tilemap row past the units tile

export function renderStageCountdownDigits(m) {
  const { mem8 } = m;

  // Sample the live stage countdown from work RAM 0x8901. This is the number to display.
  let value = mem8[STAGE_COUNTDOWN];
  if (value >= SINGLE_DIGIT_LIMIT) {
    // Two-digit path only: bail out entirely while the play-mode latch PLAY_MODE_LATCH (0x8f50)
    // is nonzero — during that mode a different path is responsible for this readout, so painting
    // here would fight it. (Single-digit values, below, never consult the latch.)
    if (mem8[PLAY_MODE_LATCH] !== 0) return; // gated while the play-mode latch is held
    // The hardware has no binary->decimal instruction, so convert the raw count to packed BCD:
    // tens in the high nibble, units in the low nibble, ready to split one digit per tile.
    value = binToPackedBcd(m, value).a; //     two-digit values render in packed BCD
  }

  // Draw the units digit: the low nibble selects the digit glyph, written to the units HUD tile
  // HUD_STAGE_DIGIT_LO (0x8743) in the tilemap. This cell is painted on every pass.
  mem8[HUD_STAGE_DIGIT_LO] = value & 0x0f; // units nibble (always drawn)
  // Isolate the tens digit (high nibble). For a single-digit value this is 0.
  const tens = (value >> 4) & 0x0f;
  // Leading-zero suppression: when the tens digit is zero (any value below ten) leave the tens
  // cell untouched rather than stamping a "0" glyph, so the number reads as one digit on screen.
  if (tens === 0) return; // leading-zero suppression
  // Draw the tens digit one tilemap row over (0x8743 + 0x20 = 0x8763): the high nibble selects
  // its glyph, completing the two-cell number.
  mem8[HUD_STAGE_DIGIT_LO + TENS_ROW_STRIDE] = tens;
}
