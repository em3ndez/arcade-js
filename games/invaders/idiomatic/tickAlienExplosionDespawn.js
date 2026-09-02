// SPDX-License-Identifier: GPL-3.0-only
import { ALIEN_EXPLOSION_TIMER, ALIEN_EXPLOSION_ADDR } from "./names.js";
import { clearSpriteColumn } from "./clearSpriteColumn.js";
import { retirePlayerShot } from "./retirePlayerShot.js";

// Tick the alien-explosion despawn timer; while it still counts, do nothing. On expiry, clear the
// explosion's screen column then retire the player shot; value-out A, live-out HL.
export function tickAlienExplosionDespawn(m) {
  m.mem8[ALIEN_EXPLOSION_TIMER] = m.mem8[ALIEN_EXPLOSION_TIMER] - 1;
  if (m.mem8[ALIEN_EXPLOSION_TIMER] !== 0) return;
  // seat the column start, clear 16 rows, then run the deactivation tail
  return (m.regs.hl = m.mem16[ALIEN_EXPLOSION_ADDR]), clearSpriteColumn(m, 0x10), retirePlayerShot(m);
}
