// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  OBJECT_AXIS0_FRAC, ENEMY_VEL0_LO, ENEMY_VEL0_HI, ENEMY_SLOT_FLAGS,
  OBJECT_INDEX_TABLE, ENEMY_VEL1_LO, ENEMY_VEL1_HI, OBJECT_AXIS1_POS,
  OBJECT_RECORD_TABLE, ENEMY_VEL2_LO, ENEMY_VEL2_HI, ENEMY_POS2,
} from "./names.js";

/**
 * integrate — step one motion axis of one enemy slot by its 16-bit velocity.
 *
 * Role in the machine: the free-flight integrator's per-axis kernel. An enemy that
 * has just spawned drifts through the tube under a three-axis fixed-point velocity;
 * this fold advances a single axis one frame. Each axis carries a fraction byte and a
 * signed whole (velocity split as low + whole), plus a whole position cell.
 *
 * Behaviour: add the low velocity into the fraction, keeping the 6502 add's carry-out
 * (sum > 0xff). Then form the new whole = signed-whole-velocity + old-whole + carry,
 * masked to a byte. Report ring overflow: a rising axis (velocity sign bit clear)
 * overflows when the whole reaches the tube's far rim (>= 0xf0); a falling axis
 * (sign bit set) overflows when it drops below the near rim (< 0x10). The [0x10,0xf0)
 * band is the live tube; leaving it means the enemy has flown off the ring.
 *
 * Live-out: writes the updated fraction back to (frac+x); returns { w, overflow }
 * without committing the whole (the caller decides where each axis's whole lands).
 * Grounding: [seen].
 */
function integrate(mem8, frac, vlow, sign, whole, x) {
  const sum = mem8[u16(frac + x)] + mem8[u16(vlow + x)]; // fraction += low velocity (keep carry-out)
  mem8[u16(frac + x)] = sum;
  const s = mem8[u16(sign + x)]; // signed whole velocity for this axis
  const w = (s + mem8[u16(whole + x)] + (sum > 0xff ? 1 : 0)) & 0xff; // new whole = vel + old whole + carry
  const overflow = (s & 0x80) ? w < 0x10 : w >= 0xf0; // left the live tube band [0x10,0xf0)?
  return { w, overflow };
}

/**
 * advanceEnemyFreeFlight — integrate slot x's three free-flight axes one frame. ROM 0xa6a9
 * (free-flight enemy motion step).
 *
 * Role in the machine: one of Tempest's two enemy locomotion styles. A freshly spawned
 * enemy flies through the tube under an independent three-axis velocity (the other style
 * is the lane-by-lane climb). Each live frame the slot walk in stepEnemyFleetAndSpawn calls
 * this to nudge the slot, then decays its velocity. The three axes fold their velocity into
 * position and the routine watches for any axis crossing the tube ring [0x10,0xf0) — the
 * signal that this enemy has flown off the playfield and must be retired.
 *
 * Behaviour: integrate axis 0 into whole0 (its whole, zeroed if it overflowed). Integrate
 * axis 1, committing its whole to OBJECT_AXIS1_POS,x, and axis 2, committing to ENEMY_POS2,x;
 * if either overflows it also forces whole0 to 0. Finally axis 0's whole0 is stamped into the
 * shared slot cell ENEMY_SLOT_FLAGS,x — which doubles as the slot's alive flag, so writing 0
 * on any axis's overflow retires the slot.
 *
 * Live-out: ENEMY_SLOT_FLAGS,x (axis-0 whole / alive flag), OBJECT_AXIS1_POS,x, ENEMY_POS2,x,
 * and all three fraction cells; returns whole0 (exit-Y register live-out the caller carries on).
 * Grounding: [seen].
 */
export function advanceEnemyFreeFlight(m, x = m.regs.x) {
  const { mem8 } = m;
  // Axis 0: integrate but hold its whole in a register; it commits to the shared cell last.
  const a0 = integrate(mem8, OBJECT_AXIS0_FRAC, ENEMY_VEL0_LO, ENEMY_VEL0_HI, ENEMY_SLOT_FLAGS, x);
  let whole0 = a0.overflow ? 0 : a0.w; // axis-0 overflow already zeroes the shared whole

  // Axis 1: commit its own whole now; any overflow also kills axis 0's whole (retires the slot).
  const a1 = integrate(mem8, OBJECT_INDEX_TABLE, ENEMY_VEL1_LO, ENEMY_VEL1_HI, OBJECT_AXIS1_POS, x);
  if (a1.overflow) whole0 = 0;
  mem8[u16(OBJECT_AXIS1_POS + x)] = a1.w;

  // Axis 2: same pattern — commit its whole, and its overflow also retires the slot.
  const a2 = integrate(mem8, OBJECT_RECORD_TABLE, ENEMY_VEL2_LO, ENEMY_VEL2_HI, ENEMY_POS2, x);
  if (a2.overflow) whole0 = 0;
  mem8[u16(ENEMY_POS2 + x)] = a2.w;

  // Stamp axis 0's whole into the shared slot cell (0 here means the slot is now dead).
  mem8[u16(ENEMY_SLOT_FLAGS + x)] = whole0;
  return whole0; // exit Y live-out
}
