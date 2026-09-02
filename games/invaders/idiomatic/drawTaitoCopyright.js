// SPDX-License-Identifier: GPL-3.0-only
import { drawSpriteList } from "./drawSpriteList.js";
import { INPUT_CODE_STAGE_FLAG, TAITO_COPYRIGHT_TEXT, TAITO_COPYRIGHT_SCREEN_ADDR } from "./names.js";

// Gate on a one-shot flag and two successive port-1 codes; once both match, draw the sprite list.
export function drawTaitoCopyright(m) {
  if (m.mem8[INPUT_CODE_STAGE_FLAG] === 0) {
    if ((m.io.portIn(0x01) & 0x76) !== 0x72) return;
    m.mem8[INPUT_CODE_STAGE_FLAG] = 1;
  }
  if ((m.io.portIn(0x01) & 0x76) !== 0x34) return;
  return drawSpriteList(m, TAITO_COPYRIGHT_TEXT, 0x09, TAITO_COPYRIGHT_SCREEN_ADDR);
}
