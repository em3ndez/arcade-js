// SPDX-License-Identifier: GPL-3.0-only
/** drawRoundNumberCaption — draw the round number as two decimal digits into a caption frame, then verify a fixed
 * block of program bytes. Nothing is drawn once the number reaches 100. The caption frame is
 * painted first and its cursor stepped down onto the two digit cells; each digit then goes through
 * the leading-zero dropping painter, the tens carrying an allowance that lets a leading zero vanish
 * and the ones inheriting whatever the tens left, so a trailing zero always shows. The tail folds a
 * fixed span of program bytes onto a seed and, on a genuine image, comes to zero; any other sum
 * means the bytes were altered, and this throws rather than run on. LIVE-OUT: memory. */

import { u8 } from "../../../core/int.js";
import { PEN_COLOUR, ROUND_NUMBER, holdCopyrightThenEraseTheCoinInvitation_ADDR } from "./names.js";
import { drawCaptionInPenColour } from "./drawCaptionInPenColour.js";
import { retreatCharCursor } from "./retreatCharCursor.js";
import { advanceCharCursor } from "./advanceCharCursor.js";
import { paintDigitDroppingLeadingZero } from "./paintDigitDroppingLeadingZero.js";

const FIELD_CAPTION = 0x0e;
const CHECK_LEN = 16;
const CHECK_SEED = 0x8c;

export function drawRoundNumberCaption(m) {
  const { regs, mem8 } = m;
  const value = mem8[ROUND_NUMBER];
  if (value >= 100) return;

  regs.a = FIELD_CAPTION;
  drawCaptionInPenColour(m);
  retreatCharCursor(m);
  retreatCharCursor(m);

  const colour = mem8[PEN_COLOUR];
  paintDigitDroppingLeadingZero(m, Math.floor(value / 10), 1, colour);
  advanceCharCursor(m);
  paintDigitDroppingLeadingZero(m, value % 10, regs.b, colour);
  advanceCharCursor(m);

  let checksum = CHECK_SEED;
  for (let i = 0; i < CHECK_LEN; i++) checksum = u8(checksum + mem8[holdCopyrightThenEraseTheCoinInvitation_ADDR + i]);
  if (checksum !== 0) throw new Error("Time Pilot: program block did not sum to zero; the image was altered.");
}
