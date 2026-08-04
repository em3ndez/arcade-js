// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_13a1 — a timer-gated in-game sub-state handler: wait out the sub-state countdown, then
 * pick the sub-state to run next from player 1's saved life count.
 *
 * The sub-state selector picks which small per-frame handler the in-game state runs. This is
 * one of those handlers, and it is a wait-then-act:
 *
 *   - the shared sub-state countdown is ticked down one, and while it has not expired the rest
 *     of the handler is skipped. So nothing below runs on any frame except the one the counter
 *     reaches zero on.
 *   - on that frame the counter is put back to 1, which re-arms the handler to fire again on
 *     the very next frame and every frame after, for as long as the selector still points here.
 *   - the first byte of player 1's saved context — that player's stored life count — decides
 *     the next sub-state: a non-zero count leaves the selector pointing at this handler, so it
 *     keeps re-running; a zero count hands off to a different one.
 *
 * NOT CLAIMED: what the two sub-states this chooses between mean in game terms. The name stays
 * address-shaped because that meaning is not established — the wait, the re-arm and the
 * lives-driven choice are, and they are all this file asserts.
 *
 * LIVE-OUT: memory-only — the sub-state countdown and the sub-state selector.
 */

import { SUBSTATE_TIMER, GAME_SUBSTATE, P1_CONTEXT } from "./names.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";

export function loc_13a1(m) {
  const { mem } = m;

  // Tick the sub-state countdown; do nothing else until the frame it expires on.
  if (!tickSubstateTimer(m)) return;

  // Re-arm the just-expired countdown to 1 so the handler fires again next frame.
  mem.write8(SUBSTATE_TIMER, (mem.read8(SUBSTATE_TIMER) + 1) & 0xff);

  // Player 1's saved life count picks the next sub-state: non-zero keeps this handler
  // running, zero hands off.
  const p1 = mem.read8(P1_CONTEXT);
  mem.write8(GAME_SUBSTATE, p1 !== 0 ? 0x17 : 0x14);
}
