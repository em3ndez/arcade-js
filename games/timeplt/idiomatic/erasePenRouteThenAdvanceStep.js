// SPDX-License-Identifier: GPL-3.0-only
/** erasePenRouteThenAdvanceStep — attract-sequence arm (phase 1, sub-step 0): fold a fixed 256-byte program run into an
 * eight-bit total and derail into the checksum-failure landing on any total but the genuine one;
 * otherwise set the pen colour and stamp glyph (to blank), arm the pen to its route start, and step
 * the sequence sub-step -- twice when the pen colour already held its set value. LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { loc_08fa } from "./loc_08fa.js";
import { armThePenRouteThenColdStartOnATamperedImage } from "./armThePenRouteThenColdStartOnATamperedImage.js";
import { advanceSequenceSubStep } from "./advanceSequenceSubStep.js";
import { PEN_COLOUR } from "./names.js";

const CHECKED_BLOCK = 0x4aa0;
const CHECKED_BYTES = 0x100;
const GENUINE_TOTAL = 0xb8;
const STAMP_GLYPH = 0xad0b;
const BLANKING_GLYPH = 0xf1;
const PEN_COLOUR_VALUE = 5;

export function erasePenRouteThenAdvanceStep(m) {
  const { regs, mem8 } = m;

  let total = 0;
  for (let i = 0; i < CHECKED_BYTES; i++) total = u8(total + mem8[u16(CHECKED_BLOCK + i)]);
  regs.a = total;
  regs.sub(GENUINE_TOTAL);
  if (regs.fNZ) return loc_08fa(m);

  const penColourWasSet = mem8[PEN_COLOUR] === PEN_COLOUR_VALUE;
  mem8[PEN_COLOUR] = PEN_COLOUR_VALUE;
  mem8[STAMP_GLYPH] = BLANKING_GLYPH;
  armThePenRouteThenColdStartOnATamperedImage(m);
  if (penColourWasSet) advanceSequenceSubStep(m);
  return advanceSequenceSubStep(m);
}
