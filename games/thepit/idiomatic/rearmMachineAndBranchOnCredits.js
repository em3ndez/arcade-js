// SPDX-License-Identifier: GPL-3.0-only
/**
 * rearmMachineAndBranchOnCredits — the boot/restart state entry: re-arm the machine, then fork on the credit
 * count to either the held credit screen or into play.  ROM 0x01f9.
 *
 * Reached by a jump from the reset epilogue (and the game-over teardown), so it is a
 * state ENTRY, not a called subroutine: it hard-resets the stack to the top of work RAM,
 * discarding whatever frame the jumper left behind, and never returns to it. After the
 * reset it re-arms the machine — turns the per-frame interrupt on, arms the secondary
 * game-state byte, commits the cabinet DIP settings — and then forks on the credit count:
 *
 *   - Credits present (count > 0): hand off to the held credit screen, which paints a canned
 *     screen and spins on it forever. Control never comes back.
 *   - No credits (count 0, the normal path): mute the audio, clear the game-mode byte, paint the
 *     fixed screen for a beat, then enter play — which seeds the round and drops into the
 *     main loop, also never returning.
 *
 * The secondary game-state byte is armed on BOTH paths, before the fork, because the DIP
 * decode folds it into its flip-screen configuration. The game-mode clear on the normal
 * path is transient: entering play overwrites it with the play value straight after.
 *
 * What the held-screen game mode means in the attract cycle is not pinned to the naming
 * bar, so the name stays neutral; the sequence above is exactly what the routine does.
 * Both exits are tail hand-offs into never-returning state entries — the
 * warm-restart credit-screen hold (showCreditScreen, 0x021c) and, past enterPlayMode, the
 * round init (initRoundAndEnterMainLoop) that falls into the main loop — so each is kept as an m.call boundary
 * the equivalence harness can stub or bound. No register is handed back, and the caller's
 * frame is gone.
 *
 * Memory-equivalent to the frozen oracle — equivalence-01f9.test.js.
 * GATE:     crafted-harness — the real boot dispatch takes the no-credits path (captured
 *           ~frame 700 as attract cycles into the demo); the credits-present path is a crafted
 *           entry (the credit count poked nonzero identically on both sides). Both exits
 *           run entire never-returning delegatees, so the two forever-spinning tails
 *           (round init 0x031a, credit-screen painter 0x3ba8) are stubbed identically on
 *           both arms and the frame-wait busy-loops inside the fixed-screen paint are
 *           driven by the same once-per-frame countdown tick on both — so each stops at
 *           the tail boundary. Teeth: an inverted fork on each path (caught at the
 *           game-mode byte) and a corrupted painted cell.
 * LIVE-OUT: memory-only — the secondary game-state byte plus everything the delegated
 *           re-arm / paint / play-entry writes; the audio and flip-screen control lines
 *           are driven for the live game but sit outside the RAM diff. No register or
 *           flag is read back (both exits spin forever and the caller's frame was
 *           discarded by the stack reset).
 * NAMES:    GAME_STATE (0x8001), ACTIVE_PLAYER (0x8002), and the credit count CREDIT_COUNT
 *           (0x8000) from names.js. enableNmi / applyDipSwitches / disableSound /
 *           showFixedScreen / enterPlayMode are called directly; the credit
 *           screen (showCreditScreen, 0x021c) is kept as an m.call boundary — it holds a
 *           screen forever, so it stays a stubbable/boundable registry boundary.
 *
 * PURPOSE [guess]: meaning of the held credit-screen mode in the attract cycle.
 */

import { enableNmi } from "./enableNmi.js";
import { applyDipSwitches } from "./applyDipSwitches.js";
import { disableSound } from "./disableSound.js";
import { showFixedScreen } from "./showFixedScreen.js";
import { enterPlayMode } from "./enterPlayMode.js";
import { GAME_STATE, ACTIVE_PLAYER, CREDIT_COUNT, STACK_TOP } from "./names.js";

export function* rearmMachineAndBranchOnCredits(m) {
  const { mem8, regs } = m;

  // Hard restart: drop the stack to the top of work RAM, discarding the frame the
  // jumper left behind. This is a state entry — it never returns to its caller.
  regs.sp = STACK_TOP;

  // Re-arm the machine: turn the per-frame interrupt on and arm the secondary
  // game-state byte, which the DIP decode below folds into its flip-screen configuration.
  enableNmi(m);
  mem8[ACTIVE_PLAYER] = 1;
  applyDipSwitches(m);

  // Fork on the credit count.
  if (mem8[CREDIT_COUNT] !== 0) {
    // Credits present: show the held credit screen, which spins on it forever.
    // m.call boundary: tail hand-off into the never-returning credit-screen hold
    // (showCreditScreen 0x021c, which tails into holdFixedScreen and displays forever);
    // a direct call is behaviorally identical and a terminal-test would be a fragile artifact.
    return yield* m.call(0x021c);
  }

  // Normal path: mute the audio, clear the game-mode byte (entering play overwrites it
  // straight after), hold the fixed screen for a beat, then enter play.
  disableSound(m);
  mem8[GAME_STATE] = 0;
  yield* showFixedScreen(m);
  return yield* enterPlayMode(m);
}
