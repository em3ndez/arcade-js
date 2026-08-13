// SPDX-License-Identifier: GPL-3.0-only
/** handPlayOverToOtherPlayer — give the turn to the other player: flip the one-bit active-player
 * index, re-arm the shared sequence delay, reseat the inner sequence index from a program byte.
 * Flipping the index IS the hand-over: every per-player cell is reached through it, nothing is
 * copied, and the skip arm writes the other two cells too. LIVE-OUT: memory, three cells. */

import { SEQUENCE_SUBSTEP, ACTIVE_PLAYER, SEQUENCE_DELAY, HANDOVER_SUBSTEP_SEED } from "./names.js";

const HANDOVER_DELAY = 90;

export function handPlayOverToOtherPlayer(m) {
  const { mem8 } = m;
  mem8[ACTIVE_PLAYER] = (mem8[ACTIVE_PLAYER] + 1) & 1;
  mem8[SEQUENCE_DELAY] = HANDOVER_DELAY;
  mem8[SEQUENCE_SUBSTEP] = mem8[HANDOVER_SUBSTEP_SEED];
}
