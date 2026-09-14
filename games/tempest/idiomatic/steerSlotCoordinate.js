// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  ENEMY_ANIM_ACCUM, NEAR_DEPTH_THRESHOLD, PLAYER_SEGMENT, PLAYER_FINE_ANGLE, ENEMY_SLOT_DIR, ENEMY_SEGMENT, ENEMY_PHASE, ENEMY_DEPTH, FIRE_GATE,
} from "./names.js";
import { advanceEnemyLaneDepth, reverseEnemyLaneDepth } from "./stepEnemyDepthInLaneDirection.js";
import { insertObjectHeadTag7 } from "./insertObjectHeadTag9.js";

/**
 * steerSlotCoordinate — advance one enemy slot's depth along its lane and seed on-player. ROM 0x9cb6.
 *
 * Role in the machine: every active enemy on the tube travels in/out along its lane; this steps slot X one
 * tick of that motion. The slot's direction bit (ENEMY_SLOT_DIR,x bit7) says whether it is retreating
 * (sub-step, moving away) or advancing (add-step, moving toward the rim), and at the end — if the enemy has
 * arrived at the player's exact position and nothing blocks it — it seeds a fresh object for that slot. This
 * is the per-slot body the enemy update loop sweeps over.
 *
 * Behavior, two arms then a shared tail:
 *  - bit7 set (SUB-step): reverseEnemyLaneDepth steps the depth backward and returns the new high byte. Y is
 *    loaded from FIRE_GATE and persists into the tail; its zero-ness picks the probe — probe = FIRE_GATE!=0 ?
 *    stepped-hi : 0xff. If probe >= NEAR_DEPTH_THRESHOLD the enemy has reached the far threshold, so flip
 *    ENEMY_SLOT_DIR,x bit7 to reverse direction.
 *  - bit7 clear (ADD-step): y is a steering index — 0 if ENEMY_DEPTH,x is already at/over NEAR_DEPTH_THRESHOLD,
 *    else 1 — and advanceEnemyLaneDepth steps forward, returning the Y the tail's seed will use (deep arms
 *    overwrite the index, shallow arms keep it).
 *  - common tail: bail if ENEMY_ANIM_ACCUM bit7 is set (busy), or ENEMY_DEPTH,x >= NEAR_DEPTH_THRESHOLD (not
 *    close enough), or PLAYER_SEGMENT != ENEMY_SEGMENT,x (wrong lane), or PLAYER_FINE_ANGLE != ENEMY_PHASE,x
 *    (wrong angle). Only when all four line up — the enemy is on the player — seed a fresh object via
 *    insertObjectHeadTag7 with X = the slot and the stepped Y (which the seed stores).
 *
 * Live-out: ENEMY_DEPTH,x / the lane depth pair stepped by the chosen arm, possibly a flipped ENEMY_SLOT_DIR,x
 * bit7, and on the seed arm a new object. X passes through; m.regs.a on each exit is the last compare operand
 * (incidental on the seed arm). Grounding: [seen].
 */
export function steerSlotCoordinate(m, x = m.regs.x) {
  const { mem8 } = m;
  let y;
  if (mem8[u16(ENEMY_SLOT_DIR + x)] & 0x80) {
    const stepped = reverseEnemyLaneDepth(m, x, 1);
    y = mem8[FIRE_GATE]; // ldy FIRE_GATE -- persists as Y into the tail; Z of it picks the probe
    const probe = y !== 0 ? stepped : 0xff;
    if (probe >= mem8[NEAR_DEPTH_THRESHOLD]) mem8[u16(ENEMY_SLOT_DIR + x)] ^= 0x80; // reached threshold -> flip direction
  } else {
    y = mem8[u16(ENEMY_DEPTH + x)] >= mem8[NEAR_DEPTH_THRESHOLD] ? 0 : 1; // steering index into the add step
    [, y] = advanceEnemyLaneDepth(m, x, y); // the tail's seed uses the Y the add step returns
  }
  // common tail
  const c148 = mem8[ENEMY_ANIM_ACCUM];
  if (c148 & 0x80) return (m.regs.a = c148);
  const coord = mem8[u16(ENEMY_DEPTH + x)];
  if (coord >= mem8[NEAR_DEPTH_THRESHOLD]) return (m.regs.a = coord);
  const v200 = mem8[PLAYER_SEGMENT];
  if (v200 !== mem8[u16(ENEMY_SEGMENT + x)]) return (m.regs.a = v200);
  const v201 = mem8[PLAYER_FINE_ANGLE];
  if (v201 !== mem8[u16(ENEMY_PHASE + x)]) return (m.regs.a = v201);
  return insertObjectHeadTag7(m, x, y); // all four match -> seed the object (A left as the callee's leftover)
}
