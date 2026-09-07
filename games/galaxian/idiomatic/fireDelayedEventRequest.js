// SPDX-License-Identifier: GPL-3.0-only
// fireDelayedEventRequest — arm-and-count-down one-shot that raises a deferred event request.
//
// WHAT IT IS
//   A per-frame tick over a small arm/timer/request triple. While armed it decrements the delay each
//   frame and does nothing until the count reaches zero. On that zero tick it disarms itself (so the
//   event fires exactly once), then raises the request — but only if two enable gates are still set.
//
// ROLE IN THE MACHINE
//   Implements a fixed-latency deferred trigger: something earlier sets DELAYED_EVENT_ARMED (0x422e)
//   bit0 and loads DELAYED_EVENT_TIMER (0x422f); this routine spends the delay and then posts
//   DELAYED_EVENT_REQUEST (0x4229) for a later consumer to act on. The two guards make the request
//   conditional on the object subsystem still being live (OBJ_ACTIVE_FLAG 0x4200 bit0) and on a second
//   permission bit at loc_41ef — so a state change during the wait can quietly cancel the pending event.
//
// ROM 0x15c3.  Grounding: [seen].
//
// LIVE-OUT: DELAYED_EVENT_TIMER decremented; on expiry DELAYED_EVENT_ARMED cleared and,
// when both gates hold, DELAYED_EVENT_REQUEST set to 1.
import { DELAYED_EVENT_ARMED, DELAYED_EVENT_TIMER, DELAYED_EVENT_REQUEST, OBJ_ACTIVE_FLAG, loc_41ef } from "./names.js";

export function fireDelayedEventRequest(m) {
  const { mem8 } = m;

  // Nothing to do unless the one-shot is armed (bit0 of DELAYED_EVENT_ARMED, 0x422e).
  if (!(mem8[DELAYED_EVENT_ARMED] & 0x01)) return;

  // Armed: spend one frame of the delay. Keep waiting while the timer has not yet hit zero.
  mem8[DELAYED_EVENT_TIMER] = mem8[DELAYED_EVENT_TIMER] - 1;
  if (mem8[DELAYED_EVENT_TIMER] !== 0) return;

  mem8[DELAYED_EVENT_ARMED] = 0; // one-shot: disarm

  // The delay elapsed. Fire only while both enable gates still hold — the object subsystem must be live
  // (OBJ_ACTIVE_FLAG bit0) and the secondary permission bit at loc_41ef must be set. Either clear cancels.
  if (!(mem8[OBJ_ACTIVE_FLAG] & 0x01)) return;
  if (!(mem8[loc_41ef] & 0x01)) return;
  // Both gates open: post the deferred request for its downstream consumer.
  mem8[DELAYED_EVENT_REQUEST] = 1;
}
