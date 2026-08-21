// SPDX-License-Identifier: GPL-3.0-only
import { ANIM_SCRIPT_CURSOR, ANIM_SCRIPT_RESET_PTR } from "./names.js";
import { foldTargetPresenceBits } from "./foldTargetPresenceBits.js";
/**
 * loc_22e6 — step one actor's animation script, IX being the actor record.
 *
 * (IX+0x0e) is a frame countdown: while non-zero it just ticks down and returns. At zero it pulls the
 * next entry from the shared script cursor. A normal entry is a {tile, colour, delay} triple copied
 * into the record and the cursor is advanced past it. A 0xff lead byte is a control marker: the two
 * bytes following it replace the cursor (a script jump) and the loop re-reads there. (A rival full
 * reset to the base script only fires when the target-presence fold reaches 3, which it never does —
 * that fold seeds 0 and is only rotated, so the marker always resolves as the inline jump.)
 *
 * LIVE-OUT: none (memory only) — the record's animation fields and the advanced script cursor.
 */
const CTRL_MARKER = 0xff; //  a script lead byte flagging a control marker
const RESET_TALLY = 3; //     fold value that would force a full reset (unreached)
const OFF_DELAY = 0x0e; //    (IX+0x0e) frame countdown / hold
const OFF_COLOUR = 0x0f; //   (IX+0x0f) colour attribute
const OFF_TILE = 0x10; //     (IX+0x10) tile code

export function loc_22e6(m, rec = m.regs.ix) {
  const { mem8, mem16 } = m;

  if (mem8[rec + OFF_DELAY] !== 0) {
    mem8[rec + OFF_DELAY] = mem8[rec + OFF_DELAY] - 1;
    return;
  }

  for (;;) {
    const cur = mem16[ANIM_SCRIPT_CURSOR];
    const lead = mem8[cur];
    if (lead !== CTRL_MARKER) {
      mem8[rec + OFF_TILE] = lead;
      mem8[rec + OFF_COLOUR] = mem8[cur + 1];
      mem8[rec + OFF_DELAY] = mem8[cur + 2];
      mem16[ANIM_SCRIPT_CURSOR] = cur + 3;
      return;
    }
    if (foldTargetPresenceBits(m) !== RESET_TALLY) {
      mem8[ANIM_SCRIPT_CURSOR] = mem8[cur + 1];
      mem8[ANIM_SCRIPT_CURSOR + 1] = mem8[cur + 2];
    } else {
      mem16[ANIM_SCRIPT_CURSOR] = ANIM_SCRIPT_RESET_PTR;
    }
  }
}
