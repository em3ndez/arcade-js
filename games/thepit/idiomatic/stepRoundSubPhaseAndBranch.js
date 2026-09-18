// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepRoundSubPhaseAndBranch — sequence the round sub-phase byte and hand off to setup or teardown.
 *
 * The round/mode dispatcher jumps here when the mode-count byte is not 1. This toggles the round
 * sub-phase (ACTIVE_PLAYER, held at 1 or 2) and, on two continuation-select flags, routes control
 * to one of two continuations: a round-setup path (reload the player, decode the switches, rebuild
 * the setup screen) or an end-of-round teardown-and-reset path. Each arm tail-hands to its chosen
 * continuation, whose return carries back to this routine's caller. What the two flags mean in
 * game terms is not pinned, so the name stays plain.
 */

import { ACTIVE_PLAYER, PLAYER1_MEN_BACKUP, PLAYER2_MEN_BACKUP } from "./names.js";
import { setUpRoundAndHoldIntro } from "./setUpRoundAndHoldIntro.js";
import { submitHighScoresAndReset } from "./submitHighScoresAndReset.js";

export function* stepRoundSubPhaseAndBranch(m) {
  const { mem8 } = m;

  // Sub-phase 1 advances to 2; the second flag sends it straight to setup.
  if (mem8[ACTIVE_PLAYER] === 1) {
    mem8[ACTIVE_PLAYER] = 2;
    if (mem8[PLAYER2_MEN_BACKUP] !== 0) return yield* setUpRoundAndHoldIntro(m);
  }

  // Reset the sub-phase to 1; the first flag alone routes to setup.
  mem8[ACTIVE_PLAYER] = 1;
  if (mem8[PLAYER1_MEN_BACKUP] !== 0) return yield* setUpRoundAndHoldIntro(m);

  // Neither flag chose setup: advance the sub-phase to 2, then take teardown when the
  // second flag is clear, otherwise fall through to setup.
  mem8[ACTIVE_PLAYER] = 2;
  if (mem8[PLAYER2_MEN_BACKUP] === 0) return yield* submitHighScoresAndReset(m);
  return yield* setUpRoundAndHoldIntro(m);
}
