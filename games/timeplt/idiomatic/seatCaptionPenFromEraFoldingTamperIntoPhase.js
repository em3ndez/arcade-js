// SPDX-License-Identifier: GPL-3.0-only
/** seatCaptionPenFromEraFoldingTamperIntoPhase — seat the caption pen from the active player's era, and fold an image block into a
 * tamper cell as it goes. It sums a fixed run of program bytes into the sequence-phase cell (net
 * zero on a genuine image, so the phase is left standing) then, off the era of whichever save block
 * is active, reads a two-byte glyph/colour record and writes it both into that save block and onto
 * the live pen. If the pen colour already held that value the sequence is stepped an extra time.
 * It then re-arms the pen route and steps the sequence once more as a tail. LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { armThePenRouteThenColdStartOnATamperedImage } from "./armThePenRouteThenColdStartOnATamperedImage.js";

const PHASE_ACCUMULATOR = 0xa9ab;
const IMAGE_BLOCK = 0x178c;
const IMAGE_BYTES = 0x1e;
const GENUINE_BIAS = 0x2c;

const ACTIVE_PLAYER = 0xad32;
const SAVED_PEN_ONE = 0xad1b;
const SAVED_ERA_ONE = 0xad14;
const SAVED_PEN_TWO = 0xad2b;
const SAVED_ERA_TWO = 0xad24;

const GLYPH_COLOUR_TABLE = 0x0f8d;
const LIVE_PEN_GLYPH = 0xad0b;
const LIVE_PEN_COLOUR = 0xad0c;

export function seatCaptionPenFromEraFoldingTamperIntoPhase(m) {
  const { regs, mem8 } = m;

  let total = mem8[PHASE_ACCUMULATOR];
  for (let i = 0; i < IMAGE_BYTES; i++) total = u8(total + mem8[u16(IMAGE_BLOCK + i)]);
  mem8[PHASE_ACCUMULATOR] = u8(total + GENUINE_BIAS);

  const playerTwo = mem8[ACTIVE_PLAYER] !== 0;
  const savedPen = playerTwo ? SAVED_PEN_TWO : SAVED_PEN_ONE;
  const era = playerTwo ? mem8[SAVED_ERA_TWO] : mem8[SAVED_ERA_ONE];

  regs.a = u8(era * 2);
  regs.hl = GLYPH_COLOUR_TABLE;
  const glyph = fetchTableByte(m);
  mem8[savedPen] = glyph;
  mem8[LIVE_PEN_GLYPH] = glyph;

  const colour = mem8[u16(regs.hl + 1)];
  mem8[savedPen + 1] = colour;
  const penColourHeld = colour === mem8[LIVE_PEN_COLOUR];
  mem8[LIVE_PEN_COLOUR] = colour;

  if (penColourHeld) advanceSequenceSubStep(m);
  armThePenRouteThenColdStartOnATamperedImage(m);
  return advanceSequenceSubStep(m);
}
