// SPDX-License-Identifier: GPL-3.0-only
import {
  MAINLOOP_SUBSTATE_SELECTOR,
  SUBSTATE_FIELD1_COUNTER,
  BONUS_STAGE_TALLY_DISPLAY_CMD,
} from "./names.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";

/**
 * queueBonusStageTallyDisplayOnDelay — main-loop sub-state 2: a one-shot frame-delay countdown
 * that, on expiry, hands the machine to the next scripted sub-state and paints the bonus-stage
 * points tally. ROM 0x1090-0x10a1. Grounding: [seen].
 *
 * WHAT IT IS: the ordinary play loop is a six-way state machine. Each frame the sub-state
 * dispatcher reads MAINLOOP_SUBSTATE_SELECTOR (0x8f5c), masks it to three bits, and vectors to
 * one of six handlers. Sub-states 0 and 1 are the per-frame workers (the active play frame);
 * sub-states 2 through 5 are a one-way SCRIPT — a chain of timers where each state, on expiry,
 * bumps the selector to the next state, so the machine marches 2 -> 3 -> 4 -> 5. That script is
 * the choreography that stages the bonus / round-transition sequence. This routine is the first
 * link, sub-state 2: it holds the machine in place for a fixed number of frames, then kicks off
 * the tally display and steps the script forward.
 *
 * ITS ROLE IN THE MACHINE: it is the beat before the bonus-stage scoreboard appears. While it
 * counts, the surrounding frame still runs its object-sweep and sprite-rebuild passes, so the
 * playfield stays live; only when the delay elapses does the scoreboard get requested and the
 * script advance to the HUD-digit painter (sub-state 3).
 *
 * TWO CELLS IT TOUCHES:
 *   - SUBSTATE_FIELD1_COUNTER (0x8f62): the scratch countdown timer shared by the scripted
 *     sub-states. This handler treats it as the frame delay before the tally shows.
 *   - MAINLOOP_SUBSTATE_SELECTOR (0x8f5c): the six-way selector; bumping it by one moves the
 *     script from state 2 into state 3.
 *
 * LIVE-OUT: memory only. Either the decremented delay counter (still waiting), or the
 * incremented selector plus one bonus-stage tally command appended to the display-command ring.
 * No register output.
 */

export function queueBonusStageTallyDisplayOnDelay(m) {
  const { mem8 } = m;

  // STILL COUNTING? Read the shared countdown timer SUBSTATE_FIELD1_COUNTER (0x8f62). While it
  // is non-zero the delay has not elapsed: tick it down by one and leave the frame untouched, so
  // the machine dwells in sub-state 2 for one more frame. The tally is not requested and the
  // selector does not move until the timer hits zero.
  if (mem8[SUBSTATE_FIELD1_COUNTER] !== 0) {
    mem8[SUBSTATE_FIELD1_COUNTER] -= 1; // still counting — tick the delay down and bail
    return;
  }

  // DELAY EXPIRED. On the frame the counter reaches zero, advance the script: bump
  // MAINLOOP_SUBSTATE_SELECTOR (0x8f5c) by one so the next dispatch vectors to sub-state 3, the
  // HUD-digit painter that follows in the bonus-transition chain.
  mem8[MAINLOOP_SUBSTATE_SELECTOR] += 1; // counter expired — advance the sub-state selector

  // Request the bonus-stage scoreboard: append BONUS_STAGE_TALLY_DISPLAY_CMD (0x0634) to the
  // display-command ring. The ring's consumer drains it a frame later and paints the points
  // tally ("BONUS POINT" / "MEAT .. 00 PTS" / "WOLF .. 00 PTS").
  enqueueDisplayCommand(m, BONUS_STAGE_TALLY_DISPLAY_CMD); // enqueue the bonus-stage tally display command
}
