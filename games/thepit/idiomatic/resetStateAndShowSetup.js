// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetStateAndShowSetup — reset/round-restart epilogue: begin a fresh attract cycle with no active
 * player, commit the cabinet settings, show the setup screen, then hand off to the
 * reset/entry handler.  ROM 0x03ac.
 *
 * Reached at the tail of cold boot (from the power-on init) and again at each
 * per-player teardown. It readies the machine for a new attract/game cycle in a few
 * steps:
 *
 *   1. Clear the active-player number so nobody is playing (the idle/attract state),
 *      and arm the secondary game-state byte.
 *   2. Read the cabinet DIP switches and fan their bits into the gameplay-parameter
 *      block the round setup consumes (difficulty, bonus/lives, flip-screen).
 *   3. Paint the round-setup screen and hold it briefly while an accent colour cycles.
 *   4. Hand off to the reset/entry handler, which re-establishes the stack, enables the
 *      per-frame interrupt, and drives the attract/play flow from there.
 *
 * The handoff never comes back here — the reset handler re-seats the stack and runs the
 * game loop — so this is a tail hand-off (rearmMachineAndBranchOnCredits, kept as an m.call boundary because it
 * never returns), and that handler owns everything downstream.
 *
 * The identifier stays neutral: this is one of a family of near-identical reset/entry
 * epilogues (the power-on init, the two entry handlers, the round (re)init) that all
 * clear state, decode the DIP switches, and jump onward, none of them yet decompiled or
 * named. Telling this one's role crisply apart from its siblings needs the whole family
 * understood first, so a specific English verb would be a guess — kept resetStateAndShowSetup.
 *
 * Memory-equivalent to the frozen oracle — equivalence-03ac.test.js.
 * GATE:     crafted-entry — the real boot dispatch (captured via the overrides hook, with
 *           0x01f9 stubbed to a no-op during capture only, so the boot cascade terminates),
 *           plus a DIP-byte sweep poked identically on both sides. For the comparison both
 *           arms run the REAL reset handler rearmMachineAndBranchOnCredits, whose flag-clear path re-enters play
 *           and falls into the never-returning main loop; one shared watchdog hook drives
 *           the thirty setup-screen frame-waits (and rearmMachineAndBranchOnCredits's own paints) and stops both
 *           arms at the main loop's entry. RAM diff outside the dead stack-scratch window;
 *           pc/SP/registers excluded per the memory-equivalence contract. Reached once at
 *           boot (not per-frame attract).
 * LIVE-OUT: memory-only — the two state bytes it writes plus everything the DIP decode
 *           and the setup-screen paint leave in work/colour/video RAM. Nothing reads a
 *           register back: the power-on init tail-jumps here and just propagates onward.
 * NAMES:    GAME_STATE (0x8001), ACTIVE_PLAYER (0x8002) from ram.js. rearmMachineAndBranchOnCredits is the reset
 *           handler, kept as an m.call boundary (0x01f9) — it re-seats the stack and runs the
 *           never-returning game loop, so it stays a stubbable/boundable registry boundary
 *           rather than a direct call; the setup-call return slot 0x03bb is a code address,
 *           not RAM.
 *
 * PURPOSE [guess]: which member of the reset/entry-epilogue family this is.
 */

import { applyDipSwitches } from "./applyDipSwitches.js";
import { showSetupScreen } from "./showSetupScreen.js";
import { GAME_STATE, ACTIVE_PLAYER } from "./ram.js";

export function resetStateAndShowSetup(m) {
  const { mem8 } = m;

  // Fresh attract cycle: no active player, secondary state armed.
  mem8[GAME_STATE] = 0;
  mem8[ACTIVE_PLAYER] = 1;

  // Commit the cabinet DIP settings into the gameplay-parameter block.
  applyDipSwitches(m);

  // Paint + briefly hold the round-setup screen. showSetupScreen still models its own
  // return through the stack (its callers were oracle when it was decompiled), so it is
  // handed the return slot the reset flow would leave for it — the same way it hands its
  // own still-stack-return leaves theirs.
  m.push16(0x03bb);
  showSetupScreen(m);

  // Hand off to the reset/entry handler and never return here.
  // m.call boundary: tail hand-off into the never-returning reset/entry handler (rearmMachineAndBranchOnCredits
  // 0x01f9, which re-seats the stack and runs the game loop); a direct call is behaviorally
  // identical and a terminal-test would be a fragile artifact.
  return m.call(0x01f9);
}
