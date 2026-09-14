// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { OBJECT_AXIS1_POS, ENEMY_SLOT_FLAGS, ENEMY_POS2, ENEMY_VEL1_LO, ENEMY_VEL0_LO, ENEMY_VEL2_LO, ENEMY_VEL1_HI, ENEMY_VEL0_HI, ENEMY_VEL2_HI, POKEY1_RANDOM, POKEY2_RANDOM } from "./names.js";
import { drawSignedVelocityNudge } from "./drawSignedVelocityNudge.js";
import { gateSound1f } from "./gateSound1f.js";

// Spawn an enemy into slot x: mark its three state bytes active, fill three
// velocity/coordinate pairs from the RNG (forcing the middle step non-positive),
// then hand off to the sound cue.
export function spawnEnemyInSlot(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  mem8[u16(OBJECT_AXIS1_POS + x)] = 0x80;
  mem8[u16(ENEMY_SLOT_FLAGS + x)] = 0x80;
  mem8[u16(ENEMY_POS2 + x)] = 0x80;

  const r0 = mem8[POKEY2_RANDOM];
  mem8[u16(ENEMY_VEL1_LO + x)] = r0;
  mem8[u16(ENEMY_VEL1_HI + x)] = drawSignedVelocityNudge(m, r0);

  const r1 = mem8[POKEY1_RANDOM];
  mem8[u16(ENEMY_VEL0_LO + x)] = r1;
  let step = drawSignedVelocityNudge(m, r1);
  if ((step & 0x80) === 0) step = u8(-step); // keep already-negative, else negate
  mem8[u16(ENEMY_VEL0_HI + x)] = step;

  const r2 = mem8[POKEY1_RANDOM];
  mem8[u16(ENEMY_VEL2_LO + x)] = r2;
  mem8[u16(ENEMY_VEL2_HI + x)] = drawSignedVelocityNudge(m, r2);

  gateSound1f(m, x, y);
}
