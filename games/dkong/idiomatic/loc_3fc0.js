// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3fc0 — pin a fixed pose into Mario's hardware sprite record and hand back a
 * pointer to that record's Y field.  ROM 0x3FC0.
 *
 * A tiny leaf used inside loc_2259's Y-descend (the still-translated caller at 0x2285):
 * that caller nudges Mario down one pixel, calls this, then increments the byte this
 * routine points it at. What this routine itself does is two things:
 *
 *   - Force the CODE byte of Mario's hardware sprite record to a fixed value of 3.
 *     Mario's sprite code packs a horizontal-mirror flag in the top bit and an
 *     animation code in the low bits; a bare 3 is one of the climb-frame codes (3,4,5)
 *     with the mirror flag cleared, so this pins one specific descend/climb pose no
 *     matter what the record's code byte held before.
 *   - Advance past the record's attribute byte to its Y field and return that address,
 *     so the caller can go straight on to move the sprite's Y without recomputing the
 *     pointer. That returned pointer is the routine's real product besides the pose
 *     write — the caller consumes it on the very next step.
 *
 * The attribute byte in between is deliberately stepped over, never written.
 *
 * NAME: kept the neutral loc_ — the mechanism (pin the record's pose byte to 3, return
 * a pointer to its Y field) is pinned to the oracle, but which descend/climb animation
 * this serves, and the exact meaning of pose 3 here, are not grounded to the
 * routine-name bar; the sole caller is still the untranslated oracle, so the game
 * purpose cannot yet be corroborated. Promote once it is.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3fc0.test.js.
 * GATE:     crafted-entry — 0x3FC0 is never dispatched in attract (its only caller is
 *           still-translated and unwired), so there are no real captures. Instead the
 *           routine is provably input-independent — it reads no memory and no registers —
 *           and the gate proves that by running it against the oracle over many base
 *           states with the three target record bytes pre-poked to adversarial values
 *           and the entry pointer varied: the write, the untouched neighbours, and the
 *           returned pointer come out invariant every time. Teeth: a wrong-address
 *           write, a spurious neighbour write, and a wrong returned pointer, all caught.
 * LIVE-OUT: the returned pointer (the oracle's HL live-out, 0x694F) plus memory. The
 *           sole caller reads that pointer straight after the call (it increments the
 *           byte at it), so it is a genuine live-out and this routine returns it. The
 *           oracle's residual registers/flags are dead — the caller overwrites them
 *           before any read.
 * NAMES:    MARIO_SPRITE_RECORD (0x694C), SPRITE_CODE (+1), SPRITE_Y (+3) — all from
 *           ram.js; the two target cells are MARIO_SPRITE_RECORD+SPRITE_CODE (0x694D)
 *           and MARIO_SPRITE_RECORD+SPRITE_Y (0x694F).
 */

import { MARIO_SPRITE_RECORD, SPRITE_CODE, SPRITE_Y } from "./ram.js";

// The pose stamped into the record's code byte: one of Mario's climb-frame codes
// (3,4,5), here pinned to 3 with the mirror flag clear.
const POSE_CODE = 3;

/**
 * @param {object} m  the machine (writes one work-RAM byte).
 * @returns {number} address of Mario's sprite-record Y field — the caller's next target.
 */
export function loc_3fc0(m) {
  const { mem } = m;

  // Pin the record's code byte to the fixed pose.
  mem.write8(MARIO_SPRITE_RECORD + SPRITE_CODE, POSE_CODE);

  // Hand back a pointer to the record's Y field, stepping over the attribute byte
  // (which is left untouched).
  return MARIO_SPRITE_RECORD + SPRITE_Y;
}
