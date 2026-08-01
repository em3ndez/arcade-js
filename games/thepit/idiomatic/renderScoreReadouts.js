// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderScoreReadouts — lay the three score-readout numbers into their on-screen display cells.  ROM 0x4cca.
 *
 * The game keeps three numeric readouts side by side (the score / high-score
 * display). Each is described by a small source record in work RAM — a 3-tile
 * label block followed by the readout's two-byte value — and the three records sit
 * back to back. This routine paints all three into the readout strip:
 *
 *   - The label tiles are copied verbatim into the readout's display cell.
 *   - The two-byte value is moved into the shared staging slot the digit unpacker
 *     reads, then the unpacker splits it into digit cells (top digit first, a
 *     leading zero left blank, two trailing blanks) right after the label.
 *
 * The three readouts are drawn identically; only the third one differs in the
 * oracle in an invisible way — it reaches the digit unpacker by falling straight
 * into it rather than by a fresh call, so the unpacker's return unwinds to this
 * routine's own caller. Here that is just the loop's last pass, and this function's
 * plain return stands in for the oracle's tail return.
 *
 * Callers seed the records first — the boot bring-up seeds three zeroed records,
 * the high-score path inserts a fresh score into the table, the round path stages
 * the live numbers — then hand off here to draw them.
 *
 * The digit unpacker still takes and returns its destination through the machine's
 * pointer register (a boundary it has not yet promoted to a parameter), so each
 * readout hands it the digit-cell base that way; nothing else crosses the call.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4cca.test.js.
 * GATE:     real dispatch — fires once during the cold-boot readout bring-up (all
 *           three records zero) — plus crafted entries that poke distinct non-zero
 *           record values to exercise the digit unpacker's leading-zero-blank and
 *           full-six-digit arms across all three readouts. RAM-only diff (pc/SP and
 *           the dead value registers excluded), so it survives the digit unpacker's
 *           tail-return dissolving; the oracle's one 2-byte stack push below the
 *           entry pointer is dead scratch and is excluded. Teeth: a twin that skips
 *           the third readout, and a twin that stages the value byte-swapped.
 * LIVE-OUT: memory-only — the three readouts' label cells + digit cells and the
 *           shared value-staging slot. No register or flag is live out (the oracle's
 *           residual pointer/counter are dead scratch every caller reloads).
 * NAMES:    SCORE_DISPLAY_LOW (0x8037) from ram.js — low byte of the 16-bit value
 *           staging slot the digit unpacker reads. The source records (0x8039) are
 *           HIGH_SCORE_TABLE; the readout display cells are SCORE_READOUT_DEST (0x8283).
 */

import { unpackScoreDigits } from "./unpackScoreDigits.js";
import { SCORE_DISPLAY_LOW, SCORE_READOUT_DEST } from "./ram.js";

const READOUT_COUNT = 3;

// The three source records sit back to back: each is a 3-tile label block then a
// two-byte value, so records start 5 bytes apart.
const SOURCE_BASE = 0x8039;
const SOURCE_STRIDE = 5;
const LABEL_TILES = 3; // also the offset of the value within a record

// Each readout's display cells: the label block, then the digit cells the unpacker
// fills. The three readouts are 9 cells apart, and the digits follow the 3 label tiles.
const DIGIT_DEST_BASE = SCORE_READOUT_DEST + LABEL_TILES;
const DEST_STRIDE = 9;

export function renderScoreReadouts(m) {
  const { mem8, mem16, regs } = m;

  for (let readout = 0; readout < READOUT_COUNT; readout++) {
    const source = SOURCE_BASE + readout * SOURCE_STRIDE;
    const labelDest = SCORE_READOUT_DEST + readout * DEST_STRIDE;
    const digitDest = DIGIT_DEST_BASE + readout * DEST_STRIDE;

    // Copy the label tiles verbatim into this readout's display cell.
    for (let i = 0; i < LABEL_TILES; i++) mem8[labelDest + i] = mem8[source + i];

    // Stage this readout's value where the digit unpacker reads it, hand it the
    // digit-cell base, and let it fill the digits.
    mem16[SCORE_DISPLAY_LOW] = mem16[source + LABEL_TILES];
    regs.hl = digitDest;
    unpackScoreDigits(m);
  }
}
