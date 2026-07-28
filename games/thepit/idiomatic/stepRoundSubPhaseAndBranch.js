// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepRoundSubPhaseAndBranch — sequence the round sub-phase byte and hand off to setup or teardown.  ROM 0x02a1.
 *
 * The round/mode dispatcher jumps here when the mode-count byte is not 1 (see dockManAndDispatchRoundBoundary).
 * This routine toggles the round sub-phase (GAME_STATE2, held at 1 or 2) and, on two
 * continuation-select flags, routes control to one of two continuations: the round-setup
 * path (setUpRoundAndHoldIntro — reload the player, decode the switches, rebuild the setup screen) or
 * the end-of-round teardown-and-reset path (loc_0371).
 *
 *   - If the sub-phase is currently 1, advance it to 2; when the second flag is set,
 *     go straight to setup.
 *   - Otherwise reset the sub-phase to 1; the first flag alone routes to setup.
 *   - Failing both, advance the sub-phase to 2 and take the teardown path when the
 *     second flag is clear, else fall through to setup.
 *
 * Every arm ends in a hand-off: the chosen continuation runs and its own return carries
 * back to THIS routine's caller (a tail hand-off, so this routine has no return of its
 * own). Neither continuation reads a value from here — each overwrites the accumulator
 * before it reads anything — so nothing needs to be marshalled across the hand-off.
 *
 * NAME kept stepRoundSubPhaseAndBranch: the mechanism (toggle the sub-phase, pick setup vs teardown) is
 * clear, but what the two continuation-select flags mean in game terms is not pinned, so
 * an English name would over-claim the routine's role.
 *
 * Memory-equivalent to the frozen oracle — equivalence-02a1.test.js.
 * GATE:     crafted-entry — stepRoundSubPhaseAndBranch is on the round-transition path, never dispatched in
 *           attract, so it is validated on real machine states captured at a shared attract
 *           dispatch (loc_3dae) with the sub-phase and both flags swept across every branch.
 *           The two continuations are now idiomatic (setUpRoundAndHoldIntro setup / submitHighScoresAndReset
 *           teardown), called directly, so both sides run the real continuation chain and
 *           converge at the true oracle leaves (0x031a setup / 0x01f9 reset), which are
 *           stubbed identically on both sides; the chain's RAM is diffed. Teeth = a wrong
 *           sub-phase value and a wrong continuation.
 * LIVE-OUT: memory-only — the sub-phase byte GAME_STATE2 and everything the chosen
 *           continuation leaves in RAM. No registers/flags.
 * NAMES:    GAME_STATE2 (0x8002) from ram.js. Kept as raw addresses: 0x802c / 0x802d are the
 *           two continuation-select flags (roles not pinned).
 *
 * PURPOSE [guess]: the two continuation-select flags' game meaning.
 */

import { GAME_STATE2 } from "./ram.js";
import { setUpRoundAndHoldIntro } from "./setUpRoundAndHoldIntro.js";
import { submitHighScoresAndReset } from "./submitHighScoresAndReset.js";

// The two continuation-select flags. Their game-level meaning is not pinned, so they stay
// raw addresses; here each just gates whether a transition hands off to the setup path.
const FLAG_AT_RESET = 0x802c; // consulted after the sub-phase resets to 1
const FLAG_AT_ADVANCE = 0x802d; // consulted in the two "advance to sub-phase 2" arms

export function stepRoundSubPhaseAndBranch(m) {
  const { mem8 } = m;

  // Sub-phase 1 advances to 2; the second flag sends it straight to setup.
  if (mem8[GAME_STATE2] === 1) {
    mem8[GAME_STATE2] = 2;
    if (mem8[FLAG_AT_ADVANCE] !== 0) return setUpRoundAndHoldIntro(m);
  }

  // Reset the sub-phase to 1; the first flag alone routes to setup.
  mem8[GAME_STATE2] = 1;
  if (mem8[FLAG_AT_RESET] !== 0) return setUpRoundAndHoldIntro(m);

  // Neither flag chose setup: advance the sub-phase to 2, then take teardown when the
  // second flag is clear, otherwise fall through to setup.
  mem8[GAME_STATE2] = 2;
  if (mem8[FLAG_AT_ADVANCE] === 0) return submitHighScoresAndReset(m);
  return setUpRoundAndHoldIntro(m);
}
