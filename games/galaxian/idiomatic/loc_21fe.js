// SPDX-License-Identifier: GPL-3.0-only
// Clear the packed-BCD score field selected by a counter index, then repaint it. Index 0 -> player-1 score,
// 1 -> player-2 score, 2 -> high score; each field's three digit bytes are zeroed plus a companion scratch
// byte (index 2 has no separate scratch, so its own first byte is re-zeroed). Index 3 or more descends,
// clearing+repainting every field from index-1 down to 0.
import { drawScoreFieldByIndex } from "./drawScoreFieldByIndex.js";
import { u8 } from "../../../core/int.js";
import { PLAYER1_SCORE_BCD, PLAYER2_SCORE_BCD, HIGH_SCORE_BCD, loc_40ad, loc_40ae } from "./names.js";

export function loc_21fe(m, index = m.regs.a) {
  const { mem8 } = m;

  if (index >= 3) {
    let i = index;
    for (;;) {
      i = u8(i - 1);
      loc_21fe(m, i);
      if (i === 0) return;
    }
  }

  let base, scratch;
  if (index === 0) { base = PLAYER1_SCORE_BCD; scratch = loc_40ad; }
  else if (index === 1) { base = PLAYER2_SCORE_BCD; scratch = loc_40ae; }
  else { base = HIGH_SCORE_BCD; scratch = HIGH_SCORE_BCD; }

  mem8[base] = 0;
  mem8[base + 1] = 0;
  mem8[base + 2] = 0;
  mem8[scratch] = 0;

  return drawScoreFieldByIndex(m, index);
}
