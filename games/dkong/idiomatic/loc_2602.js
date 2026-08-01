// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2602 — per-frame driver for the first of sub_25f2's three timed sprite objects.  ROM 0x2602.
 *
 * sub_25f2's object cascade updates three near-identical animated objects in a row
 * (sub_2602 / sub_262f / sub_2679); this is the first. Each frame it does three things
 * to the object whose state lives at 0x62A0/0x62A1 and whose sprite pair lives at 0x69E4:
 *
 *   1. On EVEN frames only (the ROM tests FRAME bit0 via `rrca`; an odd frame skips this
 *      whole step), tick down the 0x62A0 countdown. On the single frame it underflows
 *      past 0, reload it to 0x80 (a ~256-frame period, since it only counts on even
 *      frames) and REVERSE the object's step-direction sign at 0x62A1 (reverseStepDirection:
 *      0x62A1 := +2 if it was negative, else -2).
 *
 *   2. EVERY frame, refresh 0x63A3 from the odd-frame sign helper (sub_26e9) applied to
 *      0x62A1. On even frames sub_26e9 writes nothing and returns 0; on odd frames it
 *      rewrites 0x62A1 to 0xFF/0x01 by its current sign and returns that byte. Either
 *      way the returned byte is stored to 0x63A3.
 *
 *   3. On every 32nd frame (FRAME & 0x1F == 1) advance the object's mirrored
 *      sprite-animation counter pair at 0x69E4 one step (loc_26a6), its direction taken
 *      from 0x62A1's sign (loc_26a6 reads the select byte via DE = 0x62A1). Otherwise the
 *      routine returns here.
 *
 * The exact on-screen object/scene is UNCONFIRMED (0x69E4 is a SPRITE_BUFFER code byte and
 * loc_26a6 declined an English name for the same reason — the sprite-record trap), and the
 * whole sub_25f2 cascade is a non-executing frontier in attract, so this routine keeps the
 * neutral `loc_2602` name; a reviewer with corroboration can promote it. Not a leaf — it
 * calls reverseStepDirection (0x26DE), sub_26e9 (0x26E9, still the oracle), and loc_26a6
 * (0x26A6).
 *
 * Memory-equivalent to the frozen oracle — equivalence-2602.test.js.
 * GATE:     crafted-entry; attract never dispatches 0x2602 (0× / 2500 frames, asserted —
 *           the sub_25f2 object cascade runs only in real gameplay), so real states are
 *           reproduced by pokes on a booted machine: a full 256-value FRAME sweep, an
 *           all-256 countdown sweep (both direction arms) exercising the underflow +
 *           reverse arm, and a counter/direction grid exercising the loc_26a6 advance.
 * LIVE-OUT: memory-only. Both exits (`ret nz` when FRAME & 0x1F != 1, and the tail `ret`)
 *           feed straight back into sub_25f2's next `call`, which reads no register or flag
 *           this routine leaves — A/HL/flags are dead ABI (the RAM diff backstops that).
 * NAMES:    FRAME (0x601A). The object's state bytes 0x62A0 (even-frame countdown), 0x62A1
 *           (signed step-direction), the publish cell 0x63A3, and the sprite-pair base
 *           0x69E4 stay hex — unnamed engine/sprite scratch, named only in this prose.
 */

import { FRAME } from "./ram.js";
import { reverseStepDirection } from "./reverseStepDirection.js";
import { loc_26a6 } from "./loc_26a6.js";
import { sub_26e9 } from "../translated/sub_26e9.js";

export function loc_2602(m) {
  const { regs, mem } = m;

  // Even frames only: tick the 0x62A0 countdown. (`ld a,(FRAME) / rrca / jp c` skips on an
  // odd frame — carry = FRAME bit0.)
  if ((mem.read8(FRAME) & 0x01) === 0) {
    const next = (mem.read8(0x62a0) - 1) & 0xff; // dec (0x62A0)
    mem.write8(0x62a0, next);
    if (next === 0) {
      // Underflowed: reload the period and reverse the object's step-direction sign.
      mem.write8(0x62a0, 0x80);
      regs.hl = 0x62a1; // reverseStepDirection reads/writes (HL)
      reverseStepDirection(m);
    }
  }

  // Every frame: publish sub_26e9(0x62A1) into 0x63A3. (Even frame -> A=0, no write to
  // 0x62A1; odd frame -> 0x62A1 rewritten by its sign, A = that byte.)
  regs.hl = 0x62a1;
  sub_26e9(m);
  mem.write8(0x63a3, regs.a);

  // Every 32nd frame: advance the mirrored sprite-animation pair at 0x69E4.
  if ((mem.read8(FRAME) & 0x1f) !== 0x01) return;
  regs.de = 0x62a1; // loc_26a6's arm-select byte is mem[DE]
  regs.hl = 0x69e4; // ...its counter-pair base
  loc_26a6(m);
}
