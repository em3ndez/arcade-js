// SPDX-License-Identifier: GPL-3.0-only
import { loc_209b, loc_2068, loc_2096, loc_2097, loc_2095, SOUND_PORT5_SHADOW, ALIEN_COUNT } from "./names.js";
import { loc_176d } from "./loc_176d.js";

// Per-frame shot sound: run the burst timer down, silence at its edges, and re-seed the next burst.
export function loc_1740(m) {
  m.mem8[loc_209b] = m.mem8[loc_209b] - 1;
  if (m.mem8[loc_209b] === 0) loc_176d(m);
  if (m.mem8[loc_2068] === 0) return loc_176d(m);
  m.mem8[loc_2096] = m.mem8[loc_2096] - 1;
  if (m.mem8[loc_2096] !== 0) return;
  m.io.portOut(0x05, m.mem8[SOUND_PORT5_SHADOW]);
  if (m.mem8[ALIEN_COUNT] === 0) return loc_176d(m);
  m.mem8[loc_2096] = m.mem8[loc_2097];
  m.mem8[loc_2095] = 0x01;
  m.mem8[loc_209b] = 0x04;
}
