// SPDX-License-Identifier: GPL-3.0-only
/** seatCaptionPenFromEraFoldingTamperIntoPhase — seat the caption pen from the active player's era, and fold an image block into a
 * tamper cell as it goes. It sums a fixed run of program bytes into the sequence-phase cell (net
 * zero on a genuine image, so the phase is left standing) then, off the era of whichever save block
 * is active, reads a two-byte glyph/colour record and writes it both into that save block and onto
 * the live pen. If the pen colour already held that value the sequence is stepped an extra time.
 * It then re-arms the pen route and steps the sequence once more as a tail. LIVE-OUT: memory.
 *
 * ROM 0x335E-0x339B (frozen lift translated/loc_335e.js). Grounding: [seen] (names.js ROUTINES
 * 0x335e). Role in the machine: an arm of the two-level sequence machine. The "pen" is the
 * cell-stamping cursor the caption drawers use: PEN_GLYPH [seen] is the glyph it stamps into the
 * character plane and PEN_COLOUR [seen] the colour it stamps into the colour plane. Each player
 * has a saved context block holding a copy of both (PLAYER_ONE_PEN_GLYPH / PLAYER_TWO_PEN_GLYPH
 * [seen], colour one byte above), which the context load copies back when that player comes up.
 * Its sibling setSavedPenFromEra fills only the saved copy; this entry also sets the live pen,
 * folds the tamper block and can step the sequence twice (names.js).
 */

import { u8, u16 } from "../../../core/int.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { armThePenRouteThenColdStartOnATamperedImage } from "./armThePenRouteThenColdStartOnATamperedImage.js";
import { PEN_COLOUR, PEN_GLYPH, PLAYER_ONE_ERA_INDEX, PLAYER_ONE_PEN_GLYPH, PLAYER_TWO_ERA_INDEX, PLAYER_TWO_PEN_GLYPH, SEQUENCE_PHASE, ACTIVE_PLAYER, loc_178c, loc_0f8d_ADDR } from "./names.js";

// The fold's run length (`ld b,0x1e`, thirty bytes from 0x178C) and the constant added after it
// (`add a,0x2c`) that brings a genuine image's total back to zero change in the phase.
const IMAGE_BYTES = 0x1e;
const GENUINE_BIAS = 0x2c;

export function seatCaptionPenFromEraFoldingTamperIntoPhase(m) {
  const { mem8 } = m;

  /* Tamper tripwire. `ld a,(0xa9ab)` then `add a,(hl)` over the thirty program bytes at 0x178C
   * (loc_178c — they are also that routine's code), then `add a,0x2c`, stored back into
   * SEQUENCE_PHASE [seen]. On the genuine image the bytes plus the bias sum to 0 mod 256, so the
   * outer phase comes out unchanged; an edited block leaves the machine in a wrong phase. */
  let total = mem8[SEQUENCE_PHASE];
  for (let i = 0; i < IMAGE_BYTES; i++) total = u8(total + mem8[u16(loc_178c + i)]);
  mem8[SEQUENCE_PHASE] = u8(total + GENUINE_BIAS);

  /* Which player? ACTIVE_PLAYER [seen] is 0 for player one, 1 for player two. It picks both the
   * save block the pen record goes into (0xAD1B or 0xAD2B) and the era that selects the record
   * (PLAYER_ONE_ERA_INDEX 0xAD14 or PLAYER_TWO_ERA_INDEX 0xAD24, each [seen]). */
  const playerTwo = mem8[ACTIVE_PLAYER] !== 0;
  const savedPen = playerTwo ? PLAYER_TWO_PEN_GLYPH : PLAYER_ONE_PEN_GLYPH;
  const era = playerTwo ? mem8[PLAYER_TWO_ERA_INDEX] : mem8[PLAYER_ONE_ERA_INDEX];

  /* Glyph. `add a,a` doubles the era (two-byte records) and `rst 0x08` — fetchTableByte —
   * reads byte 0 of the record from the table at 0x0F8D, which is routine 0x0F8D's own code read
   * as data. The glyph is stored into the save block and onto the live pen (0xAD0B). */
  // the colour is the record's second byte, read straight off the indexed entry.
  const entry = u16(loc_0f8d_ADDR + u8(era * 2));
  const glyph = fetchTableByte(m, loc_0f8d_ADDR, u8(era * 2));
  mem8[savedPen] = glyph;
  mem8[PEN_GLYPH] = glyph;

  /* Colour. Byte 1 of the same record goes one byte above the saved glyph and then into
   * PEN_COLOUR (0xAD0C). The ROM's `cp (hl)` before the store tests whether the live colour
   * already held this value; the `ld (hl),a` that follows leaves that flag intact. */
  const colour = mem8[u16(entry + 1)];
  mem8[savedPen + 1] = colour;
  const penColourHeld = colour === mem8[PEN_COLOUR];
  mem8[PEN_COLOUR] = colour;

  /* Sequence bookkeeping. An unchanged colour steps SEQUENCE_SUBSTEP one extra time
   * (advanceSequenceSubStep [seen]). armThePenRouteThenColdStartOnATamperedImage [seen] puts the
   * pen back at the first point of its route and runs a second image check that cold-starts the
   * machine on a mismatch. The tail step then moves the sequence on to its next arm. */
  if (penColourHeld) advanceSequenceSubStep(m);
  armThePenRouteThenColdStartOnATamperedImage(m);
  return advanceSequenceSubStep(m);
}
