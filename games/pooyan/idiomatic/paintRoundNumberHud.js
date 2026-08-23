// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { binToPackedBcd } from "./binToPackedBcd.js";
import { loc_0c45 } from "./loc_0c45.js";
import { blitTile3x3Block } from "./blitTile3x3Block.js";
import { blitGlyphBlock4x3 } from "./blitGlyphBlock4x3.js";
import { loc_1ffb } from "./loc_1ffb.js";
import { renderStageCountdownDigits } from "./renderStageCountdownDigits.js";
import { refreshRoundStageHud } from "./refreshRoundStageHud.js";
import {
  TAMPER_FREEZE_FLAG,
  RESET_ATTR_COLUMN,
  ROUND_HUD_FIELD_SRC,
  ROUND_COUNTER,
  HUD_ROUND_DIGIT_HI,
  HUD_ROUND_DIGIT_LO,
  ROUND_BCD_LOW_STASH,
  ROUND_GLYPH_WORD_TABLE,
  ROUND_TILE_DST,
  HUD_ROUND_TILE,
} from "./names.js";
/**
 * paintRoundNumberHud — round-number HUD setup, then the per-frame HUD update chain.
 *
 * On the first pass of a round (freeze flag clear) it builds the round HUD: copy an attribute
 * field bottom-up into the attribute column through its sentinel, BCD-convert round+1 and paint
 * its two digits (blanking a leading zero), stamp the round glyph blocks (the tens bit picks the
 * glyph word), stash the low digit, and render the selector glyph. Both entries then run the update
 * chain: the timer/round-progress updater, then the stage-countdown digits.
 * LIVE-OUT: none — memory only; the caller reloads its own registers.
 */
const FIELD_TERMINATOR = 0x10; // ends the attribute field; also the blank tile
const ROW_STRIDE = 0x20; //        one tilemap row

export function paintRoundNumberHud(m) {
  const { mem8 } = m;

  if (mem8[TAMPER_FREEZE_FLAG] === 0) {
    // copy the attribute field bottom-up into the attribute column, through the sentinel
    let dst = RESET_ATTR_COLUMN;
    let src = ROUND_HUD_FIELD_SRC;
    let b;
    do {
      b = mem8[src];
      mem8[dst] = b;
      src = u16(src + 1);
      dst = u16(dst - ROW_STRIDE);
    } while (b !== FIELD_TERMINATOR);

    const bcd = binToPackedBcd(m, (mem8[ROUND_COUNTER] + 1) & 0xff).a; // BCD of round+1
    const hi = (bcd >> 4) & 0x0f;
    mem8[HUD_ROUND_DIGIT_HI] = hi !== 0 ? hi : FIELD_TERMINATOR; // blank a leading zero
    mem8[HUD_ROUND_DIGIT_LO] = bcd & 0x0f;

    const glyph = loc_0c45(m, (bcd >> 4) & 0x01, ROUND_GLYPH_WORD_TABLE); // tens bit selects the glyph word
    const [, glyphSrc] = blitTile3x3Block(m, ROUND_TILE_DST, glyph); // stamp block, advance the source
    blitGlyphBlock4x3(m, glyphSrc, HUD_ROUND_TILE);

    mem8[ROUND_BCD_LOW_STASH] = bcd & 0x0f;
    loc_1ffb(m, bcd); // render the selector glyph block (bit5 of the BCD value)
  }

  // per-frame update chain (also the freeze-set entry, which skips the setup above)
  refreshRoundStageHud(m); // timer + round-progress HUD updater
  renderStageCountdownDigits(m);
}
