// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";

/**
 * stepAxisBySelectorBits — decode the top two bits of A into a one-step nudge of
 * the Y axis value (down within 0xfa..0xff, up within 0x01..0x06, or zero), then
 * shift A left twice to consume those two bits so the next pair moves up into the
 * selector position. Returns [steppedY, (A << 2) & 0xff]; no memory writes.
 */
export function stepAxisBySelectorBits(m, a = m.regs.a, y = m.regs.y) {
  let newY;
  if ((a & 0x80) === 0) {
    // Selector 0x: step down, clamped into 0xfa..0xff.
    if (y === 0xfa) newY = 0xfa;          // floor: unchanged
    else if (y > 0xfa) newY = u8(y - 1);  // 0xfb..0xff -> decrement
    else newY = 0xff;                     // below the window -> snap to 0xff
  } else if ((a & 0x40) === 0) {
    // Selector 10: step up, clamped into 0x01..0x06.
    if (y === 0x06) newY = 0x06;          // ceiling: unchanged
    else if (y < 0x06) newY = u8(y + 1);  // 0x00..0x05 -> increment
    else newY = 0x01;                     // above the window -> snap to 0x01
  } else {
    // Selector 11: zero the axis.
    newY = 0x00;
  }
  return [(m.regs.y = newY), (m.regs.a = u8(a << 2))];
}
