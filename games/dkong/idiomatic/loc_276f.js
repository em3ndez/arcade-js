// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_276f — step Mario's Y toward the top of its travel, or edge-reset once it arrives.
 * ROM 0x276F.
 *
 * One arm of the per-frame vertical-reposition machine sub_2745, chosen while Mario's X
 * sits in the [0x2C, 0x43) band. It looks at how far up MARIO_Y has travelled:
 *
 *   - Once MARIO_Y has passed above the 0x71 limit (its value dropped below 0x71, i.e. it
 *     reached the top of this arm's travel), it hands off to the edge reset loc_277f, which
 *     switches the mover off (MARIO_ACTIVE -> 0) and clears the reposition flag.
 *   - Otherwise it decrements MARIO_Y by one — a single pixel up the screen, since a larger
 *     Y is lower — and mirrors the new value into the Y field of Mario's hardware sprite
 *     record, so the on-screen sprite follows the move the same frame.
 *
 * The 0x71 limit and the -1 step are this arm's; the sibling arm loc_2787 runs the same
 * shape in the opposite direction, and both fall into the same loc_277f edge reset.
 *
 * NAME: kept the neutral loc_. The mechanism is exact against the oracle, but which game
 * event drives this reposition (and whether the moved object is always Mario) is not
 * confirmed to the routine-name bar — the sibling loc_277f/loc_2787 stay loc_ for the same
 * reason. Promote once corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-276f.test.js.
 * GATE:     crafted-entry, EXHAUSTIVE over the one input that decides everything — the prior
 *           MARIO_Y (0..255) — built on a real booted attract base so the surrounding work
 *           RAM is self-consistent. The sweep covers both arms outright: 0x00..0x70 take the
 *           edge-reset hand-off, 0x71..0xFF take the decrement-and-mirror. 0x276F is never
 *           dispatched in attract (verified 0 over 6000 frames — it fires only when this
 *           reposition arm is live), so crafted coverage carries the gate. Teeth: a wrong
 *           limit, a dropped sprite mirror, a missing decrement, and a skipped edge reset.
 * LIVE-OUT: memory-only. On the decrement arm: MARIO_Y (0x6205) and Mario's sprite-record Y
 *           (0x694F). On the edge-reset arm: MARIO_ACTIVE and EDGE_REPOSITION_FLAG (via
 *           loc_277f). The caller (sub_2745, itself a discarded per-frame tail) consumes no
 *           register/flag, and the terminal return is dead ABI — the equivalence test still
 *           lines pc + SP up to prove the dissolved tail-jump bracket matches.
 * NAMES:    MARIO_Y (0x6205), MARIO_SPRITE_RECORD (0x694C) + SPRITE_Y (+3 = 0x694F) from
 *           ram.js; loc_277f (ROM 0x277F) direct-called for the edge reset.
 */

import { MARIO_Y, MARIO_SPRITE_RECORD, SPRITE_Y } from "./ram.js";
import { loc_277f } from "./loc_277f.js"; // ROM 0x277F — the vertical-mover edge reset

// MARIO_Y below this = it has reached the top of this arm's travel (paired with the band
// limits 0x2C/0x43/0x6C/0x83 the dispatcher sub_2745 keys the arm off).
const TOP_LIMIT = 0x71;

/**
 * @param {object} m  the machine (uses m.mem; hands off to loc_277f).
 * @returns {void}
 */
export function loc_276f(m) {
  const { mem } = m;

  const y = mem.read8(MARIO_Y);

  // Reached the top of travel — switch the mover off and clear its edge flag.
  if (y < TOP_LIMIT) {
    loc_277f(m);
    return;
  }

  // Still travelling — step one pixel up and mirror the new Y to the sprite record so the
  // on-screen sprite tracks it. The value only lands in byte stores (which truncate), and
  // y >= 0x71 means y - 1 never goes negative, so no wrap is needed here.
  const stepped = y - 1;
  mem.write8(MARIO_Y, stepped);
  mem.write8(MARIO_SPRITE_RECORD + SPRITE_Y, stepped);
}
