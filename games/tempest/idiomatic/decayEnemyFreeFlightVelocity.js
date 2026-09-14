// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, ENEMY_SLOT_FLAGS, ENEMY_VEL1_LO, ENEMY_VEL0_LO, ENEMY_VEL2_LO, ENEMY_VEL1_HI, ENEMY_VEL0_HI, ENEMY_VEL2_HI } from "./names.js";
import { stepVelocityTowardZero } from "./stepVelocityTowardZero.js";

// Step a slot's three axis velocities one increment toward zero; when all three
// saturate, clear the slot's whole coordinate.
// Returns the last axis's stepped whole byte as a register live-out (unchanged on both exits).
export function decayEnemyFreeFlightVelocity(m, x = m.regs.x) {
  const { mem8 } = m;
  mem8[loc_29] = 0xfd; // seed the saturation counter
  // Each axis: step (low, whole) and store both back.
  {
    const [low, whole] = stepVelocityTowardZero(m, mem8[u16(ENEMY_VEL1_LO + x)], mem8[u16(ENEMY_VEL1_HI + x)]);
    mem8[u16(ENEMY_VEL1_LO + x)] = low;
    mem8[u16(ENEMY_VEL1_HI + x)] = whole;
  }
  {
    const [low, whole] = stepVelocityTowardZero(m, mem8[u16(ENEMY_VEL0_LO + x)], mem8[u16(ENEMY_VEL0_HI + x)]);
    mem8[u16(ENEMY_VEL0_LO + x)] = low;
    mem8[u16(ENEMY_VEL0_HI + x)] = whole;
  }
  let exitY; // Y register at RTS = axis-2 stepped whole
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
