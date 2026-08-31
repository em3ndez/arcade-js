// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { binToPackedBcd } from "./binToPackedBcd.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { blitTile3x3Block } from "./blitTile3x3Block.js";
import { blitGlyphBlock4x3 } from "./blitGlyphBlock4x3.js";
import { stampSelectedGlyphBlock } from "./stampSelectedGlyphBlock.js";
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
 * ROM 0x1ead-0x1f17.  Grounding: [seen].
 *
 * WHAT IT IS
 *   This is the top-of-screen "ROUND N" readout builder for one player's live round, plus the
 *   tail that keeps the rest of the top-panel readouts current every frame.  It is entered as
 *   part of the level-start batch that runs when a round is first laid out, and again every
 *   frame thereafter for the ongoing refresh.
 *
 * ROLE IN THE MACHINE
 *   The picture the player sees is a 32x32 grid of tilemap cells.  The round number that sits
 *   in the top panel is not a sprite — it is a small cluster of tile-code cells that this
 *   routine writes directly.  The one-time setup pass lays out the fixed frame around the
 *   readout, converts the current round to decimal, and stamps the round's digit glyphs and
 *   the selector glyph.  After the setup pass (or immediately, when setup is skipped) it drives
 *   the two downstream refreshers that keep the timer/round-progress area and the stage
 *   countdown digits up to date.
 *
 *   The whole setup pass is gated on the anti-tamper freeze flag TAMPER_FREEZE_FLAG (0x881e).
 *   On an intact program image that flag is always clear, so the setup runs; the flag only ever
 *   goes nonzero when one of the ROM's checksum tripwires has fired, and in that state the game
 *   deliberately stops rewriting the HUD (the setup pass is skipped) while still running the
 *   per-frame update chain so the display does not lock up entirely.
 *
 * LIVE-OUT: none — this leaves its results in memory only (the tilemap cells listed below and
 *   the stashed low digit); the caller reloads its own registers and reads nothing back.
 */
const FIELD_TERMINATOR = 0x10; // ends the attribute field; also the blank tile that hides a leading zero
const ROW_STRIDE = 0x20; //        one tilemap row = 0x20 (32) cells, so subtracting it walks straight up a column

export function paintRoundNumberHud(m) {
  const { mem8 } = m;

  // Anti-tamper gate.  TAMPER_FREEZE_FLAG (0x881e) is clear on an intact ROM, so the whole
  // round-HUD setup below runs on entry.  When a checksum tripwire has bumped the flag nonzero,
  // the machine skips the entire setup pass and falls straight through to the update chain.
  if (mem8[TAMPER_FREEZE_FLAG] === 0) {
    // STEP 1 — lay out the fixed frame around the readout.
    // Copy a 0x10-terminated attribute field out of ROM (ROUND_HUD_FIELD_SRC, 0x1ea7) into the
    // attribute column that anchors the readout (RESET_ATTR_COLUMN, 0x855f).  The source is read
    // forward one byte at a time; the destination walks UP the column one tilemap row per byte
    // (dst -= ROW_STRIDE), so the field is painted bottom-up.  The 0x10 sentinel byte both ends
    // the copy and doubles as the blank tile, so the terminator itself lands as the top cell.
    let dst = RESET_ATTR_COLUMN;
    let src = ROUND_HUD_FIELD_SRC;
    let b;
    do {
      b = mem8[src];
      mem8[dst] = b;
      src = u16(src + 1);
      dst = u16(dst - ROW_STRIDE);
    } while (b !== FIELD_TERMINATOR);

    // STEP 2 — convert the round to a two-digit decimal number.
    // ROUND_COUNTER (0x8907) is a zero-based binary count; the player-facing round is round+1.
    // binToPackedBcd turns that into packed BCD (two decimal digits in one byte: tens in the
    // high nibble, units in the low nibble).  Split the two nibbles out for separate rendering.
    const bcd = binToPackedBcd(m, (mem8[ROUND_COUNTER] + 1) & 0xff).a; // BCD of round+1
    const hi = (bcd >> 4) & 0x0f;
    // Write the tens digit to its tile cell (HUD_ROUND_DIGIT_HI, 0x849f), but blank a leading
    // zero: for rounds under 10 the tens digit is 0, so substitute the blank tile 0x10 instead
    // of drawing a "0" in front of the number.
    mem8[HUD_ROUND_DIGIT_HI] = hi !== 0 ? hi : FIELD_TERMINATOR; // blank a leading zero
    // Write the units digit to its tile cell (HUD_ROUND_DIGIT_LO, 0x847f), always drawn.
    mem8[HUD_ROUND_DIGIT_LO] = bcd & 0x0f;

    // STEP 3 — stamp the round's decorative glyph blocks.
    // Two glyph-block sources exist (a 2-entry word table in ROM, ROUND_GLYPH_WORD_TABLE at
    // 0x200d); the tens bit of the BCD value picks which one, so the block changes look between
    // the single-digit rounds and the ten-and-up rounds.  blitTile3x3Block stamps a 3x3 tile
    // block at ROUND_TILE_DST (0x8462) and returns the source pointer advanced past what it
    // consumed; that advanced pointer feeds the adjacent 4x3 glyph block stamped into
    // HUD_ROUND_TILE (0x8722).
    const glyph = fetchWordFromTableIndex(m, (bcd >> 4) & 0x01, ROUND_GLYPH_WORD_TABLE); // tens bit selects the glyph word
    const [, glyphSrc] = blitTile3x3Block(m, ROUND_TILE_DST, glyph); // stamp block, advance the source
    blitGlyphBlock4x3(m, glyphSrc, HUD_ROUND_TILE);

    // STEP 4 — stash the low digit and render the selector glyph.
    // The units digit is kept in a work cell (ROUND_BCD_LOW_STASH, 0x8483) for later use by the
    // per-frame refresh.  stampSelectedGlyphBlock then renders one of two selector glyph blocks;
    // it inspects bit 5 of the BCD value passed in to choose which block to draw.
    mem8[ROUND_BCD_LOW_STASH] = bcd & 0x0f;
    stampSelectedGlyphBlock(m, bcd); // render the selector glyph block (bit5 of the BCD value)
  }

  // STEP 5 — the per-frame update chain (also the freeze-set entry, which skips the setup above).
  // These two run on every entry regardless of the tamper gate, so the readouts stay live even
  // when the setup pass is frozen out.
  refreshRoundStageHud(m); // timer + round-progress HUD updater (0x1f18)
  renderStageCountdownDigits(m); // draw the stage-countdown number as two HUD digits (0x34c9)
}
