// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { OBJECT_AXIS1_POS, ENEMY_SLOT_FLAGS, ENEMY_POS2, ENEMY_VEL1_LO, ENEMY_VEL0_LO, ENEMY_VEL2_LO, ENEMY_VEL1_HI, ENEMY_VEL0_HI, ENEMY_VEL2_HI, POKEY1_RANDOM, POKEY2_RANDOM } from "./names.js";
import { drawSignedVelocityNudge } from "./drawSignedVelocityNudge.js";
import { gateSound1f } from "./gateSound1f.js";

/**
 * spawnEnemyInSlot — activate an enemy in slot x and give it random motion. ROM 0xa65b.
 *
 * Role in the machine: the low-level constructor for an enemy that moves in the tube's cross-section
 * (as opposed to a pure climber). Given an already-chosen slot index x, it marks the slot active and
 * fills its three coordinate axes each with a low byte drawn from a POKEY random source and a high
 * byte that is a small signed velocity nudge, so every enemy starts drifting in a slightly random
 * direction. It then hands off to the spawn sound cue.
 *
 * Behavior: the three per-slot state bytes OBJECT_AXIS1_POS (loc_263), ENEMY_SLOT_FLAGS (loc_283),
 * and ENEMY_POS2 (loc_2a3) are all set to 0x80 to mark the slot live/centered. Then three axis
 * velocity pairs are seeded. Axis 1 draws r0 from POKEY2_RANDOM into ENEMY_VEL1_LO and its signed
 * nudge (drawSignedVelocityNudge, a step in [-7,+7]) into ENEMY_VEL1_HI. Axis 0 draws r1 from
 * POKEY1_RANDOM into ENEMY_VEL0_LO; its nudge is forced non-positive — kept if already negative,
 * otherwise negated — so this middle axis always steps in the one direction, then stored in
 * ENEMY_VEL0_HI. Axis 2 draws r2 from POKEY1_RANDOM into ENEMY_VEL2_LO with a free-signed nudge in
 * ENEMY_VEL2_HI. Finally gateSound1f cues the spawn sound for slot x.
 *
 * Live-out: the three state bytes and three velocity pairs of slot x seeded, plus the queued spawn
 * sound. Grounding: [seen].
 */
export function spawnEnemyInSlot(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  mem8[u16(OBJECT_AXIS1_POS + x)] = 0x80; // mark the slot live / centered
  mem8[u16(ENEMY_SLOT_FLAGS + x)] = 0x80;
  mem8[u16(ENEMY_POS2 + x)] = 0x80;

  // Axis 1: raw RNG low byte + a free-signed velocity nudge in the high byte.
  const r0 = mem8[POKEY2_RANDOM];
  mem8[u16(ENEMY_VEL1_LO + x)] = r0;
  mem8[u16(ENEMY_VEL1_HI + x)] = drawSignedVelocityNudge(m, r0);

  // Axis 0 (middle): nudge forced non-positive so it always steps one way.
  const r1 = mem8[POKEY1_RANDOM];
  mem8[u16(ENEMY_VEL0_LO + x)] = r1;
  let step = drawSignedVelocityNudge(m, r1);
  if ((step & 0x80) === 0) step = u8(-step); // keep already-negative, else negate
  mem8[u16(ENEMY_VEL0_HI + x)] = step;

  // Axis 2: raw RNG low byte + a free-signed velocity nudge in the high byte.
  const r2 = mem8[POKEY1_RANDOM];
  mem8[u16(ENEMY_VEL2_LO + x)] = r2;
  mem8[u16(ENEMY_VEL2_HI + x)] = drawSignedVelocityNudge(m, r2);

  gateSound1f(m, x, y); // cue the spawn sound for this slot
}
