// SPDX-License-Identifier: GPL-3.0-only
/**
 * armBehaviorGateOnInputOrTimer -- set the behavior gate loc_4208 on a timer tick or an active input line.
 *
 * WHAT IT IS
 *   The arming half of a behavior-gate pair that drives loc_4208 (mechanisms.md "Background timers layered
 *   over play"). Once per frame it decides whether to raise that gate, choosing between two triggers by a
 *   mode flag. Its acknowledger counterpart, clearGateOnPendingRequest, consumes a pending request and
 *   clears the gate back down; here we only ever set it.
 *
 * ROLE IN THE MACHINE
 *   Runs only while the object subsystem is enabled (OBJ_ACTIVE_FLAG 0x4200 bit0 set) and the gate is not
 *   already armed (loc_4208 bit0 clear). The mode flag loc_4006 bit0 then selects the trigger:
 *     - timer path (loc_4006 bit0 clear): arm the gate roughly every 32 frames, on the frames where the
 *       low five bits of the free-running FRAME_COUNTER (0x425f) are all zero.
 *     - input path (loc_4006 bit0 set): test bit 4 of the selected input shadow -- IN0_SHADOW (0x4010) or
 *       IN1_SHADOW (0x4011), chosen by loc_4018 bit0 -- masked against its guard byte (loc_4013 / loc_4014,
 *       matching the choice). If that bit is set in the line and clear in the guard, arm both the gate
 *       loc_4208 and its companion flag loc_41cc.
 *
 * ROM 0x0a32.  Grounding: [seen].
 *
 * LIVE-OUT: memory only -- loc_4208 (both paths) and, on the input path, loc_41cc. No register result.
 */
import { OBJ_ACTIVE_FLAG, loc_4208, loc_4006, loc_4018, loc_4013, IN0_SHADOW, loc_4014, IN1_SHADOW, loc_41cc, FRAME_COUNTER } from "./names.js";

export function armBehaviorGateOnInputOrTimer(m) {
  const { mem8 } = m;

  // Two guard conditions common to both paths: the object subsystem must be active, and there is nothing
  // to do if the gate is already armed (its acknowledger will lower it in due course).
  if ((mem8[OBJ_ACTIVE_FLAG] & 1) === 0) return; // enable gate closed
  if (mem8[loc_4208] & 1) return;         // already armed

  if ((mem8[loc_4006] & 1) === 0) {
    // Timer path: FRAME_COUNTER (0x425f) counts every frame, so its low five bits are zero on one frame
    // in 32. Bail on every other frame; on that one frame arm the gate. This paces the behavior to fire
    // about every 32 frames regardless of input.
    // range test: arm only when the low five bits are all clear
    if (mem8[FRAME_COUNTER] & 0x1f) return;
    mem8[loc_4208] = 1;
    return;
  }

  // Input path: pick which input shadow and guard byte to read from loc_4018 bit0 -- the "alt" select
  // between the IN0 pair (loc_4013 guard) and the IN1 pair (loc_4014 guard). The guard masks off bits
  // the game does not want to react to (e.g. already-held lines), so a line counts as freshly active
  // only where its bit 4 is set AND the guard's bit 4 is clear.
  // input-mask test: bit 4 set in the line and clear in its guard means active
  const alt = mem8[loc_4018] & 1;
  const line = alt ? mem8[IN1_SHADOW] : mem8[IN0_SHADOW];
  const guard = alt ? mem8[loc_4014] : mem8[loc_4013];
  if ((line & ~guard & 0x10) === 0) return; // no active line

  // Active line: arm both the behavior gate and its companion flag loc_41cc so the input-driven behavior
  // and its side effect both fire this frame.
  mem8[loc_4208] = 1;
  mem8[loc_41cc] = 1;
}
