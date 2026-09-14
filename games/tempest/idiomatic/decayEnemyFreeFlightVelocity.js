// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, ENEMY_SLOT_FLAGS, ENEMY_VEL1_LO, ENEMY_VEL0_LO, ENEMY_VEL2_LO, ENEMY_VEL1_HI, ENEMY_VEL0_HI, ENEMY_VEL2_HI } from "./names.js";
import { stepVelocityTowardZero } from "./stepVelocityTowardZero.js";

/**
 * decayEnemyFreeFlightVelocity — bleed one enemy slot's free-flight velocity toward rest. ROM 0xa721.
 *
 * Role in the machine: an enemy knocked into free flight (e.g. a blown-off piece drifting in the
 * tube) carries a 16-bit velocity on each of three axes. Every frame this routine nudges all three
 * velocities one increment toward zero so the drift coasts to a stop, and once the whole slot has
 * come to rest it retires the slot by clearing its coordinate.
 *
 * Behavior: seed the shared saturation counter loc_29 = 0xfd (it is decremented once per axis inside
 * stepVelocityTowardZero, reaching zero only if every axis was already at rest). Then, for slot x,
 * step each of the three velocity pairs one increment toward zero — axis 1 (ENEMY_VEL1_LO/HI =
 * loc_2c3/loc_323), axis 0 (ENEMY_VEL0_LO/HI = loc_2e3/loc_343), axis 2 (ENEMY_VEL2_LO/HI =
 * loc_303/loc_363) — writing the stepped low and whole bytes back to their cells. Keep axis 2's
 * stepped whole byte as the exit value (the Y register live-out of the original RTS). If the counter
 * did not reach zero at least one axis still had motion, so leave the slot alone; only when all three
 * saturated in the same frame clear the slot's whole coordinate (ENEMY_SLOT_FLAGS / loc_283,x).
 *
 * Live-out: the three velocity pairs (stepped one increment), loc_29 (consumed), on full rest the
 * slot coordinate loc_283,x = 0x00, and the returned axis-2 whole byte (unchanged on both exits).
 * Grounding: seen.
 */
export function decayEnemyFreeFlightVelocity(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_29] = 0xfd; // seed the saturation counter; each axis decrements it, zero == all at rest
  // Axis 1: step (low, whole) toward zero and store both back.
  {
    const [low, whole] = stepVelocityTowardZero(m, mem8[u16(ENEMY_VEL1_LO + x)], mem8[u16(ENEMY_VEL1_HI + x)]);
    mem8[u16(ENEMY_VEL1_LO + x)] = low;
    mem8[u16(ENEMY_VEL1_HI + x)] = whole;
  }
  // Axis 0: step (low, whole) toward zero and store both back.
  {
    const [low, whole] = stepVelocityTowardZero(m, mem8[u16(ENEMY_VEL0_LO + x)], mem8[u16(ENEMY_VEL0_HI + x)]);
    mem8[u16(ENEMY_VEL0_LO + x)] = low;
    mem8[u16(ENEMY_VEL0_HI + x)] = whole;
  }
  let exitY; // Y register at RTS = axis-2 stepped whole
  // Axis 2: step (low, whole) toward zero, store both back, and keep the whole byte as the exit value.
  {
    const [low, whole] = stepVelocityTowardZero(m, mem8[u16(ENEMY_VEL2_LO + x)], mem8[u16(ENEMY_VEL2_HI + x)]);
    mem8[u16(ENEMY_VEL2_LO + x)] = low;
    mem8[u16(ENEMY_VEL2_HI + x)] = whole;
    exitY = whole;
  }
  // Counter reaches zero only when every axis saturated.
  if (mem8[loc_29] !== 0) return exitY;
  mem8[u16(ENEMY_SLOT_FLAGS + x)] = 0x00;
  return exitY;
}
