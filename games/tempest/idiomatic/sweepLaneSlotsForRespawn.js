// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { ENEMY_SLOT_TOP, WAVE_PHASE_LATCH, ENEMY_SLOT_DIR, ENEMY_DEPTH } from "./names.js";
import { respawnEnemyAndAward } from "./respawnEnemyAndAward.js";

/**
 * sweepLaneSlotsForRespawn -- find the next occupied lane slot and respawn its enemy. ROM 0xa888.
 *
 * Role in the machine: between waves Tempest walks the enemy slots looking for one that still holds a
 * living creature so it can bring it back into play (and award its points). This runs only during the
 * timed part of the phase cycle: the wave-phase latch (0x125) must be at least 3 AND even -- odd phases
 * and phases below 3 are other stages of the between-wave sequence and are skipped. When the sweep does
 * fire it hands the found slot to respawnEnemyAndAward; when the sweep finds nothing it declares the
 * phase finished by zeroing the latch.
 *
 * Behavior: gate on WAVE_PHASE_LATCH (0x125) -- return if below 3, return if odd. Then scan the enemy
 * depth table ENEMY_DEPTH (0x2df),y downward starting at y = ENEMY_SLOT_TOP (0x11c). The first slot whose
 * depth is nonzero (an occupied slot) is the hit: clear the low two direction bits of ENEMY_SLOT_DIR
 * (0x28a),y and tail-delegate to respawnEnemyAndAward for that slot, returning its result. Otherwise
 * decrement y and keep scanning; the loop ends when y wraps below 0 (bit 7 sets). With no occupied slot
 * found across the whole range, reset WAVE_PHASE_LATCH to 0 to advance the between-wave state.
 *
 * Live-out: on a hit, the cleared direction bits at ENEMY_SLOT_DIR,y plus whatever respawnEnemyAndAward
 * writes; on a miss, WAVE_PHASE_LATCH (0x125) = 0. Grounding: [seen].
 */
export function sweepLaneSlotsForRespawn(m, x = m.regs.x) {
  const { mem8 } = m;

  // Only sweep on the timed phase: latch >= 3 and even. Odd/low phases are handled elsewhere.
  const phase = mem8[WAVE_PHASE_LATCH];
  if (phase < 3) return;
  if (phase & 0x01) return;

  // Scan the depth table downward from the top slot for the first occupied lane.
  let y = mem8[ENEMY_SLOT_TOP];
  while (true) {
    if (mem8[u16(ENEMY_DEPTH + y)] !== 0) {
      // Occupied slot found: clear its low two direction bits and respawn/award for it.
      mem8[u16(ENEMY_SLOT_DIR + y)] = mem8[u16(ENEMY_SLOT_DIR + y)] & 0xfc;
      return respawnEnemyAndAward(m, x, y);
    }
    y = u8(y - 1);
    if ((y & 0x80) === 0) continue; // still in range (bit7 clear) -> keep scanning
    break;                          // y wrapped past 0 -> nothing occupied
  }
  // No occupied slot anywhere: mark this phase done.
  mem8[WAVE_PHASE_LATCH] = 0;
}
