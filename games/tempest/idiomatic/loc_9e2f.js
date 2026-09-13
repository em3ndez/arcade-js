// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { PLAYER_SEGMENT, PLAYER_FINE_ANGLE, ENEMY_SLOT_FLAGS, ENEMY_SEGMENT, ENEMY_PHASE } from "./names.js";
import { loc_a33a } from "./loc_a33a.js";

// Per-slot guard: act only when the slot is live and both of its cell coords match
// the current target pair; otherwise leave everything untouched.
export function loc_9e2f(m, x = m.regs.x, seedY = m.regs.y) {
  const { mem8 } = m;
  if (mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0x80) return;             // dead slot
  if (mem8[u16(ENEMY_SEGMENT + x)] !== mem8[PLAYER_SEGMENT]) return;  // first coord mismatch
  if (mem8[u16(ENEMY_PHASE + x)] !== mem8[PLAYER_FINE_ANGLE]) return;  // second coord mismatch
  loc_a33a(m, x, seedY); // seedY (the dispatch index) is the seed's Y, threaded explicitly
}
