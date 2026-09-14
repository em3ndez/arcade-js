// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, loc_2a, ENEMY_SLOT_TOP, ENEMY_DEPTH, ENEMY_SEGMENT, PLAYER_SEGMENT } from "./names.js";
import { signedSegmentDelta } from "./signedSegmentDelta.js";

/**
 * aimSpinnerAtNearestEnemy -- auto-aim: which way to spin toward the nearest enemy. ROM 0x97c5.
 *
 * Role in the machine: the attract-mode / auto-play spinner needs a direction to turn the
 * blaster. "Nearest" here means shallowest: the enemy with the smallest nonzero depth in the
 * shot/enemy depth table is the most urgent threat. This routine finds that slot, works out
 * whether it sits clockwise or counter-clockwise of the player's current segment, and returns
 * a one-byte turn code that rotateBlasterAroundRim folds into the spinner delta. It is the
 * auto-aim half of the spinner path (the manual trackball/knob delta is the alternative).
 *
 * Behavior: seed loc_29 = 0xff (smallest value seen) and loc_2a = 0xff (its index, 0xff = none).
 * Walk the depth table ENEMY_DEPTH from ENEMY_SLOT_TOP downward: for each slot, if its depth is
 * nonzero and smaller than the running minimum, record the value and index. Stop when the index
 * counter goes negative (bit7 set). If no candidate was found (loc_2a still has bit7 set), just
 * return the last value read. Otherwise take the signed segment delta of the winner's segment
 * ENEMY_SEGMENT[idx] against the player's PLAYER_SEGMENT via signedSegmentDelta, and return a
 * code by sign: 0x00 already aligned, 0x09 when the enemy is one way, 0xf7 the other way.
 *
 * Live-out: loc_29 (min depth seen) and loc_2a (its slot index) as scratch, and m.regs.a set to
 * the returned turn code (0x00 / 0x09 / 0xf7), consumed by rotateBlasterAroundRim.
 *
 * Grounding: [seen].
 */
export function aimSpinnerAtNearestEnemy(m) {
  const { mem8 } = m;
  mem8[loc_29] = 0xff; // smallest value seen
  mem8[loc_2a] = 0xff; // its index, 0xff meaning none
  let a;
  let x = mem8[ENEMY_SLOT_TOP];
  do {
    a = mem8[u16(ENEMY_DEPTH + x)];
    if (a !== 0 && a < mem8[loc_29]) {
      mem8[loc_29] = a;
      mem8[loc_2a] = x;
    }
    x = (x - 1) & 0xff;
  } while ((x & 0x80) === 0);

  const idx = mem8[loc_2a];
  if (idx & 0x80) return (m.regs.a = a); // none found
  const diff = signedSegmentDelta(m, mem8[u16(ENEMY_SEGMENT + idx)], mem8[PLAYER_SEGMENT]);
  if (diff === 0) return (m.regs.a = diff);
  if (diff & 0x80) return (m.regs.a = 0x09);
  return (m.regs.a = 0xf7);
}
