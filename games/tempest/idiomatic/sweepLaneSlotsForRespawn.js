// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { ENEMY_SLOT_TOP, WAVE_PHASE_LATCH, ENEMY_SLOT_DIR, ENEMY_DEPTH } from "./names.js";
import { respawnEnemyAndAward } from "./respawnEnemyAndAward.js";

// Only acts when the phase cell WAVE_PHASE_LATCH is at least 3 and even. Scans ENEMY_DEPTH,y downward from y = ENEMY_SLOT_TOP
// for the first nonzero slot: found -> clear the low two bits of ENEMY_SLOT_DIR,y and tail-delegate to the slot
// handler for that slot; none found -> reset WAVE_PHASE_LATCH to 0.
export function sweepLaneSlotsForRespawn(m, x = m.regs.x) {
  const { mem8 } = m;

  const phase = mem8[WAVE_PHASE_LATCH];
  if (phase < 3) return;
  if (phase & 0x01) return;

  let y = mem8[ENEMY_SLOT_TOP];
  while (true) {
    if (mem8[u16(ENEMY_DEPTH + y)] !== 0) {
      mem8[u16(ENEMY_SLOT_DIR + y)] = mem8[u16(ENEMY_SLOT_DIR + y)] & 0xfc;
      return respawnEnemyAndAward(m, x, y);
    }
    y = u8(y - 1);
    if ((y & 0x80) === 0) continue;
    break;
  }
  mem8[WAVE_PHASE_LATCH] = 0;
}
