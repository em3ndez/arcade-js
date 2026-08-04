// SPDX-License-Identifier: GPL-3.0-only
/**
 * marioActiveGuard — answer whether Mario is alive, so a caller can abandon the rest of its work
 * when he is not.
 *
 * The player-motion, hammer and bonus updates all open with this question. It reads MARIO_ACTIVE,
 * where bit 0 set means Mario is alive and being processed and clear means he is dead and inert,
 * and answers true to proceed or false to skip. Callers consume it as an early return —
 * `if (!marioActiveGuard(m)) return;` — so a false answer stops that caller's frame dead.
 *
 * POLARITY IS THE TRAP HERE. A near-identical guard elsewhere answers on the CLEAR sense of its
 * own byte; carrying that polarity across to this one would invert every caller at once, and
 * would do so silently, because both spellings are a plausible-looking one-line predicate.
 *
 * A LEAF — it reads one byte, writes nothing and calls nothing.
 *
 * LIVE-OUT: the boolean, and nothing else. No memory is written.
 */

import { MARIO_ACTIVE } from "./names.js";

export function marioActiveGuard(m) {
  // Proceed exactly when bit 0 is SET: Mario is alive and being processed.
  return (m.mem.read8(MARIO_ACTIVE) & 0x01) !== 0;
}
