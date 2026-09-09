// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_88, loc_ab, CONFIG_DIP_BYTE, loc_a9, loc_81, loc_51, loc_f0, loc_71, loc_61,
  loc_41, loc_a1, SFX_TIMER_CH4, POKEY_RANDOM,
} from "./names.js";

/**
 * seedSegmentSpawnState -- an init leaf; seeds the fixed spawn cells for the object slot
 * selected by the per-object index cell. Derives a selector (2, dropped to 1 when the
 * slot's gate byte is 0 and a threshold clears it), mirrors it via two's-complement when a
 * random bit is set, then seeds the remaining cells to constants -- RAM only, no live-out.
 */
export function seedSegmentSpawnState(m) {
  const x = m.mem8[loc_88]; // object slot index

  let sel = 0x02;
  if (m.mem8[(loc_ab + x) & 0xff] === 0) {
    const threshold = (m.mem8[CONFIG_DIP_BYTE] & 0x40) | 0x10; // config-derived threshold
    if (threshold >= m.mem8[(loc_a9 + x) & 0xff]) sel = 0x01; // drop the selector to 1
  }
  m.mem8[loc_81] = sel; // stash the selector

  if (m.mem8[POKEY_RANDOM] & 0x04) sel = (0x100 - sel) & 0xff; // random bit -> negate
  m.mem8[loc_51] = sel; // and its (possibly negated) copy

  m.mem8[loc_71] = 0x60 ^ m.mem8[loc_f0]; // fold a fixed key into the heading cell
  m.mem8[loc_61] = 0xff; // remaining spawn cells to fixed constants
  m.mem8[loc_41] = 0xf8;
  m.mem8[loc_a1] = 0x60;
  m.mem8[SFX_TIMER_CH4] = 0x00;
}
