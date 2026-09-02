// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { advanceRecordTotals } from "./advanceRecordTotals.js";
import { loadSpriteDescriptor } from "./loadSpriteDescriptor.js";
import { blitShiftedSprite } from "./blitShiftedSprite.js";
import { loc_20c2, ANIM_COORD_STEP_LO, ANIM_SPRITE_COORD, ANIM_SPRITE_SRC, ANIM_END_COORD, ANIM_DONE_FLAG, ANIM_BASE_SPRITE_SRC } from "./names.js";

// Step the animation record totals; when the sequence reaches its target latch the done flag, else
// point at the current frame's sprite descriptor and shift-blit it onto the screen.
export function stepAnimationFrame(m) {
  m.mem8[loc_20c2] = u8(m.mem8[loc_20c2] + 1);
  const total = advanceRecordTotals(m, ANIM_COORD_STEP_LO, m.mem8[ANIM_COORD_STEP_LO]);
  if (m.mem8[ANIM_END_COORD] === total) {
    m.mem8[ANIM_DONE_FLAG] = 1;
    return (m.regs.a = 1);
  }
  let dst = m.mem16[ANIM_BASE_SPRITE_SRC];
  if ((m.mem8[loc_20c2] & 0x04) === 0) dst = u16(dst + 0x30);
  m.mem16[ANIM_SPRITE_SRC] = dst;
  const [descHl, descDe] = loadSpriteDescriptor(m, ANIM_SPRITE_COORD);
  return ((m.regs.hl = descDe), blitShiftedSprite(m, descHl));
}
