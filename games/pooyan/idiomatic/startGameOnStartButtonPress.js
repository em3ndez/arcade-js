// SPDX-License-Identifier: GPL-3.0-only
import { startSelectedPlayerGameConsumingCredits } from "./startSelectedPlayerGameConsumingCredits.js";
import { queueSoundCommand00 } from "./queueSoundCommand00.js";
import {
  CREDIT_COUNT,
  TWO_PLAYER_FLAG,
  ACTIVE_PLAYER,
  PLAYER0_LIVES,
  PLAYER1_LIVES,
  GAUGE_PHASE_COUNTER,
  INPUT_PORT0,
} from "./names.js";

/**
 * startGameOnStartButtonPress — the start-button trigger that turns a credit into a game.
 *
 * WHAT IT IS
 * Once per frame the pooyan hardware samples its coin and start buttons; the (inverted) IN0 byte
 * lands in the mirror INPUT_PORT0 (0x8810), where a pressed control reads as a set bit. This is
 * one of the two paths that turn a waiting credit into an actual start-of-life, and it is the
 * button-driven one: a guarded trigger reached through a jump-table pointer at ROM 0x7fd6. It
 * fires only when three things are true at once — a credit is banked, no game is already in
 * progress, and one of the two start buttons is being pressed this frame.
 *
 * ROLE IN THE MACHINE
 * Coins accrue into the BCD credit counter CREDIT_COUNT (0x8802); pressing start while a credit is
 * banked should hand the machine to the game builders. This routine is the gatekeeper for that
 * transition. It validates the preconditions, plays the start jingle, then tails into
 * startSelectedPlayerGameConsumingCredits, which re-reads the same start bits, spends the matching
 * number of credits (one for a 1-player start, two for a 2-player start), and enters the
 * start-of-life setup.
 *
 * ROM address: 0x7fd6-0x7ffe.
 * Grounding: [seen].
 * LIVE-OUT: none of its own. Every guard returns void; the successful path forwards to the
 * follow-on handler and returns whatever that returns. A game start's effects land in game state
 * (credit spent, machine state set to play, actor tables reset), not in a value handed back here.
 */

// Start-gate bits inside the inverted IN0 sample: bit 3 (0x08) = one-player start, bit 4 (0x10) =
// two-player start. At least one of these must be set for the button press to count as a start.
const GATE_BITS = 0x18; // input-port bits that must be set to fire

export function startGameOnStartButtonPress(m) {
  const { mem8 } = m;

  // Precondition 1: there must be a credit to spend. CREDIT_COUNT (0x8802) is the BCD credit
  // counter — coins bump it, starts consume it. A zero count means nothing is banked, so a start
  // press has nothing to act on and the trigger is inert this frame.
  if (mem8[CREDIT_COUNT] === 0) return; // no credit -> nothing to trigger

  // Precondition 2: no game may already be in progress. This is decided by folding a status byte
  // that is guaranteed zero only when the machine is idle, then bailing if the fold is nonzero.
  // TWO_PLAYER_FLAG (0x880e) selects which case we are in.
  let a, hl;
  if (mem8[TWO_PLAYER_FLAG] === 0) {
    // No two-player game is set up, so there is nothing in progress to protect. Force a guaranteed
    // zero: A = 0 and the checked cell is the (already-zero) two-player flag itself, so the guard
    // below can never trip in this branch.
    a = 0;
    hl = TWO_PLAYER_FLAG; // status = the (zero) flag itself
  } else {
    // A two-player game is set up, so a stray start press must not clobber it. Fold together two
    // liveness signals: the phase-gauge counter GAUGE_PHASE_COUNTER (0x8908), which is nonzero
    // while a round is being played, and the WAITING player's remaining lives. ACTIVE_PLAYER
    // (0x880d) selects the current player's bank, so its inverse picks the other player: when P2
    // is the active player (nonzero) check player 0's lives PLAYER0_LIVES (0x8948), otherwise
    // check player 1's lives PLAYER1_LIVES (0x8988). Either signal nonzero means a game is live.
    a = mem8[GAUGE_PHASE_COUNTER]; // folded into the status
    hl = mem8[ACTIVE_PLAYER] !== 0 ? PLAYER0_LIVES : PLAYER1_LIVES;
  }
  // Bail if the folded status is nonzero — the gauge or the waiting player's lives say a round is
  // still under way, so this frame's press must not restart the machine.
  if ((a | mem8[hl]) !== 0) return; // already active

  // Precondition 3: an actual start button must be pressed this frame. INPUT_PORT0 (0x8810) is the
  // inverted IN0 mirror, so pressed controls read as set bits; masking with GATE_BITS keeps only
  // the two start bits. If neither is set there is no press to act on.
  if ((mem8[INPUT_PORT0] & GATE_BITS) === 0) return; // gate bits clear
  // All three preconditions hold. Play the start jingle (sound command 0) to acknowledge the press.
  queueSoundCommand00(m); // enqueue sound command 0
  // Then hand off to the follow-on handler, which re-reads the same start bits to choose a one- or
  // two-player start, spends the matching credits, and runs the start-of-life setup.
  return startSelectedPlayerGameConsumingCredits(m); // tail into the follow-on handler
}
