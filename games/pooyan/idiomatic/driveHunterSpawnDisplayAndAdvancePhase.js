// SPDX-License-Identifier: GPL-3.0-only
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import {
  SUBSTATE_FIELD1_COUNTER,
  MAINLOOP_SUBSTATE_SELECTOR,
  HUNTER_SPAWN_DISPLAY_CMD,
} from "./names.js";

/**
 * driveHunterSpawnDisplayAndAdvancePhase — main-loop sub-state 4.
 *
 * WHAT IT IS
 *   The fourth handler of the main loop's own six-way state machine, at ROM 0x113c.
 *   Grounding tag: [seen].
 *
 * ROLE IN THE MACHINE
 *   The ordinary play loop is driven by a small selector, MAINLOOP_SUBSTATE_SELECTOR
 *   (0x8f5c): its low three bits pick one of six per-frame handlers. Sub-states 2..5 form a
 *   one-way scripted sequence — a chain of countdown timers that choreographs the
 *   bonus / round transition, each state marching the selector to the next as its timer
 *   drains (2 -> 3 -> 4 -> 5). This routine is the state-4 link: a timer that, while it
 *   runs, keeps the hunter-spawn display command flowing, and on expiry hands off to state 5.
 *
 *   All four scripted states (2..5) share one countdown cell, SUBSTATE_FIELD1_COUNTER
 *   (0x8f62). When state 3 finishes it leaves that cell primed for this state; when this
 *   state finishes it reseeds the cell to a full count for state 5. The selected handler is
 *   also followed each frame by the shared object/sprite pass, so the world keeps animating
 *   even though this body does nothing but tick a timer and post a display command.
 *
 * LIVE-OUT (memory only)
 *   - SUBSTATE_FIELD1_COUNTER (0x8f62): decremented while counting, or reseeded to
 *     COUNTER_RELOAD on expiry.
 *   - MAINLOOP_SUBSTATE_SELECTOR (0x8f5c): bumped by one on expiry (state 4 -> state 5).
 *   - On the counting branch, the two command bytes appended to the display-command ring.
 */

const COUNTER_RELOAD = 0x80; // full count handed to the successor state (state 5) on expiry

export function driveHunterSpawnDisplayAndAdvancePhase(m) {
  const { mem8 } = m;

  // Read the shared scripted-sequence countdown SUBSTATE_FIELD1_COUNTER (0x8f62). A value of
  // zero means this phase's dwell has elapsed and it is time to advance; any other value means
  // the phase is still running this frame.
  const timer = mem8[SUBSTATE_FIELD1_COUNTER];
  if (timer === 0) {
    // Phase over. Reseed the shared countdown to a full COUNTER_RELOAD (0x80) so the next
    // state in the script (state 5) inherits a fresh dwell to count down...
    mem8[SUBSTATE_FIELD1_COUNTER] = COUNTER_RELOAD;
    // ...then advance the main-loop sub-state selector MAINLOOP_SUBSTATE_SELECTOR (0x8f5c) by
    // one, marching the scripted sequence from state 4 to state 5. Nothing else happens on the
    // hand-off frame.
    mem8[MAINLOOP_SUBSTATE_SELECTOR] += 1;
    return;
  }

  // Phase still running: tick the shared countdown SUBSTATE_FIELD1_COUNTER (0x8f62) down one
  // frame toward its expiry.
  mem8[SUBSTATE_FIELD1_COUNTER] = timer - 1;
  // ...and, every frame the phase is active, post HUNTER_SPAWN_DISPLAY_CMD (word 0x0315) into
  // the display-command ring. The ring's consumer drains it later in the frame to paint the
  // hunter-spawn display for the duration of this state.
  enqueueDisplayCommand(m, HUNTER_SPAWN_DISPLAY_CMD);
}
