// SPDX-License-Identifier: GPL-3.0-only
import { loc_2095, loc_2097, loc_2099, loc_1a11, loc_1a21, SOUND_PORT5_SHADOW, ALIEN_COUNT } from "./names.js";
import { loc_19dc } from "./loc_19dc.js";

// On the trigger, pick a fleet-rate byte for the alien count and step the port-5 pitch nibble; tick the
// step timer and, on its wrap, re-arm the shot channel.
export function loc_1775(m) {
  if (m.mem8[loc_2095] !== 0) {
    const alive = m.mem8[ALIEN_COUNT];
    let i = 0;
    while (alive < m.mem8[loc_1a11 + i]) i++;
    m.mem8[loc_2097] = m.mem8[loc_1a21 + i];
    const shadow = m.mem8[SOUND_PORT5_SHADOW];
    const stepped = (shadow & 0x0f) << 1;
    m.mem8[SOUND_PORT5_SHADOW] = (shadow & 0x30) | (stepped === 0x10 ? 0x01 : stepped);
    m.mem8[loc_2095] = 0;
  }
  m.mem8[loc_2099] = m.mem8[loc_2099] - 1;
  if (m.mem8[loc_2099] !== 0) return (m.regs.a = 0);
  return loc_19dc(m, 0xef);
}
