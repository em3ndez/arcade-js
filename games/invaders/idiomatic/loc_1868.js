// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { advanceRecordTotals } from "./advanceRecordTotals.js";
import { loadSpriteDescriptor } from "./loadSpriteDescriptor.js";
import { blitShiftedSprite } from "./blitShiftedSprite.js";
import { loc_20c2, loc_20c3, loc_20c5, loc_20c7, loc_20ca, loc_20cb, loc_20cc } from "./names.js";

// Step the animation record totals; when the sequence reaches its target latch the done flag, else
// point at the current frame's sprite descriptor and shift-blit it onto the screen.
export function loc_1868(m) {
  m.mem8[loc_20c2] = u8(m.mem8[loc_20c2] + 1);
  const total = advanceRecordTotals(m, loc_20c3, m.mem8[loc_20c3]);
  if (m.mem8[loc_20ca] === total) {
    m.mem8[loc_20cb] = 1;
    return (m.regs.a = 1);
  }
  let dst = m.mem16[loc_20cc];
  if ((m.mem8[loc_20c2] & 0x04) === 0) dst = u16(dst + 0x30);
  m.mem16[loc_20c7] = dst;
  const [descHl, descDe] = loadSpriteDescriptor(m, loc_20c5);
  return ((m.regs.hl = descDe), blitShiftedSprite(m, descHl));
}
