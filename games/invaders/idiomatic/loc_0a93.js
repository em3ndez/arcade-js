// SPDX-License-Identifier: GPL-3.0-only
import { FRAME_DELAY_TIMER } from "./names.js";
import { drawSprite8x8 } from "./drawSprite8x8.js";
import { u8, u16 } from "../../../core/int.js";

// Type a run of `c` sprite bytes onto the screen with the attract "typing" cadence: for each byte, read
// the id at source `de`, blit an 8-row column at screen dest `hl` (which advances), then pace 7 vblank
// frames before the next byte. Generator: each pace step is one yield. Args are threaded explicitly (a
// generator's parameter-default reads are not exempt from the cruft gate). Memory-only.
export function* loc_0a93(m, de, c, hl) {
  let src = de;
  let count = c;
  let dst = hl;
  for (;;) {
    dst = drawSprite8x8(m, m.mem8[src], dst);
    m.mem8[FRAME_DELAY_TIMER] = 0x07;
    while (u8(m.mem8[FRAME_DELAY_TIMER] - 1) !== 0) yield; // pace until the counter reaches 1
    src = u16(src + 1);
    count = u8(count - 1);
    if (count === 0) break;
  }
}
