// SPDX-License-Identifier: GPL-3.0-only
import { drawSpriteList } from "./drawSpriteList.js";
import { loc_201e, loc_0bf7, loc_2e1b } from "./names.js";

// Gate on a one-shot flag and two successive port-1 codes; once both match, draw the sprite list.
export function loc_199a(m) {
  if (m.mem8[loc_201e] === 0) {
    if ((m.io.portIn(0x01) & 0x76) !== 0x72) return;
    m.mem8[loc_201e] = 1;
  }
  if ((m.io.portIn(0x01) & 0x76) !== 0x34) return;
  return drawSpriteList(m, loc_0bf7, 0x09, loc_2e1b);
}
