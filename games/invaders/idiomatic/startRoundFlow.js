// SPDX-License-Identifier: GPL-3.0-only
import { showRoundStartSplash } from "./showRoundStartSplash.js";
import { clearPlayfield } from "./clearPlayfield.js";
import { restoreShieldsAndEnterRound } from "./restoreShieldsAndEnterRound.js";
import { TASK_FLAGS } from "./names.js";

/**
 * startRoundFlow — the top of the round-start chain that feeds the in-game loop.
 *
 * WHAT IT IS
 *   A multi-frame generator that plays the round-start splash, wipes the play-field, drops the
 *   per-frame task bitfield, and then falls into the shield/field preamble that arms the round.
 *
 * ROLE IN THE MACHINE
 *   startGameFlow (via startOnePlayerGame / startTwoPlayerGame) and the next-round handoffs enter here
 *   (see mechanisms.md "The in-game main loop and round restarts"). The chain is
 *   startRoundFlow -> restoreShieldsAndEnterRound -> enterRoundWithFieldReload/…WithoutFieldReload.
 *   This routine owns the first three steps: showRoundStartSplash holds for 0xb0 displayed frames,
 *   flashing the active player's score while FRAME_DELAY_TIMER drains; clearPlayfield blanks the play
 *   area (leaving the score/status margins); and TASK_FLAGS (0x20c1) — the one-byte record of which
 *   drawing task the frame owes — is zeroed so the fresh round starts with no pending task bit. It
 *   then yields through restoreShieldsAndEnterRound, which restores the active player's shields and
 *   arms the field. It is a generator because the splash and preamble each span many frames, one
 *   yield per displayed frame; the interrupt drives the timers those steps wait on.
 *
 * Grounding: [seen] (round-start chain, mechanisms.md).
 *
 * LIVE-OUT: memory + IO across many frames; control ultimately reaches the in-game loop via the
 * enter-round tail. TASK_FLAGS left 0.
 */
export function* startRoundFlow(m) {
  // Round-start splash: hold ~0xb0 frames, flashing the active score. Each yield inside is one frame.
  yield* showRoundStartSplash(m);
  // Wipe the play-field framebuffer (the score band and bottom status strip are preserved).
  clearPlayfield(m);
  // Clear the per-frame task bitfield so the new round begins owing no drawing task.
  m.mem8[TASK_FLAGS] = 0x00;
  // Fall into the shield/field preamble, which restores this player's shields and arms the round.
  yield* restoreShieldsAndEnterRound(m);
}
