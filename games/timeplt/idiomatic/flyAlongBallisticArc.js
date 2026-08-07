// SPDX-License-Identifier: GPL-3.0-only
/** flyAlongBallisticArc — move one object a frame's worth along both axes and retire it once it has left the
 * picture. Each coordinate is 16 bits stored split, the whole part in the sprite entry and the
 * fraction in the record. Across, the object takes a fixed step whose direction is a byte of its
 * own record. Along the other axis it takes a step it does not hold constant: a second 16-bit
 * number in the record grows by a fixed amount every frame and is what gets added, so the object
 * accelerates. Both axes also take the frame's shared displacement, so the object moves with the
 * world on top of its own motion. The two whole parts are then tested against fixed limits — a
 * narrow wrapped window on the first axis, a floor on the second — and either one puts the slot
 * out of play. LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { retireSlot } from "./retireSlot.js";
import { WORLD_SCROLL_X, WORLD_SCROLL_Y } from "./names.js";

const WHOLE_ACROSS = 49;
const FRACTION_ACROSS = 3;
const WHOLE_ALONG = 0;
const FRACTION_ALONG = 5;
const DIRECTION = 1;
const SPEED_LOW = 7;
const SPEED_HIGH = 8;

const STEP_ACROSS = 384;
const SPEED_GAIN = 9;

const OFF_ACROSS_LEAD = 16;
const OFF_ACROSS_BAND = 32;
const OFF_ALONG_FROM = 248;

const split = (mem8, whole, fraction) => (mem8[whole] << 8) + mem8[fraction];

export function flyAlongBallisticArc(m) {
  const { mem8, mem16, regs } = m;
  const record = regs.ix;
  const entry = regs.iy;

  const acrossWhole = entry + WHOLE_ACROSS;
  const acrossFraction = record + FRACTION_ACROSS;
  const step = mem8[record + DIRECTION] === 0 ? STEP_ACROSS : -STEP_ACROSS;
  const across = u16(split(mem8, acrossWhole, acrossFraction) + step + mem16[WORLD_SCROLL_Y]);
  mem8[acrossWhole] = across >> 8;
  mem8[acrossFraction] = across;

  const speed = u16(split(mem8, record + SPEED_HIGH, record + SPEED_LOW) + SPEED_GAIN);
  mem8[record + SPEED_LOW] = speed;
  mem8[record + SPEED_HIGH] = speed >> 8;

  const alongWhole = entry + WHOLE_ALONG;
  const alongFraction = record + FRACTION_ALONG;
  const along = u16(split(mem8, alongWhole, alongFraction) + speed + mem16[WORLD_SCROLL_X]);
  mem8[alongWhole] = along >> 8;
  mem8[alongFraction] = along;

  if (u8(mem8[acrossWhole] + OFF_ACROSS_LEAD) < OFF_ACROSS_BAND) {
    retireSlot(m);
    return;
  }
  if (mem8[alongWhole] >= OFF_ALONG_FROM) retireSlot(m);
}
