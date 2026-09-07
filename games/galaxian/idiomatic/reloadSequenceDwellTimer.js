// SPDX-License-Identifier: GPL-3.0-only
//
// reloadSequenceDwellTimer -- ROM 0x070e, grounding [seen].
//
// WHAT IT IS
//   Re-arms the sequence machine's mid-tier dwell timer, stamping loc_4009 (0x4009) back to 80 frames.
//
// ROLE IN THE MACHINE
//   The attract/sequence state machine has no scheduler: it advances by counting down a stack of adjacent
//   bytes and letting the carry ripple up into SEQUENCE_STATE (0x400a). loc_4009 is the dwell tier that
//   sits directly below SEQUENCE_STATE, so ticking loc_4009 to zero is literally what advances the state.
//   A handler that has just advanced the state must leave the timer ready for the next sub-state, which is
//   what this helper does -- it hands off the freshly re-armed dwell. Callers such as
//   advanceSubstateAndReloadDwell (0x070d) bump the state index and then tail into here.
//
// LIVE-OUT: loc_4009 (0x4009) = 80.
import { loc_4009 } from "./names.js";

// The reload value: the timer counts down one per frame, so 80 gives this mode ~80 frames.
const TIMER_RELOAD = 80; // 0x50

export function reloadSequenceDwellTimer(m) {
  // Stamp the reload value into the mode down-counter (the dwell tier of the sequence cascade). The next
  // frames will tick it down; when it wraps past zero the carry steps SEQUENCE_STATE to the next sub-state.
  m.mem8[loc_4009] = TIMER_RELOAD;
}
