// SPDX-License-Identifier: GPL-3.0-only
//
// scheduleDelayedEvent — the gated timer that arms Galaxian's "delayed event" (an extra
// wave of attackers spawned outside the normal paced launcher).
//
// WHAT IT IS
//   A per-frame, two-tier countdown. When it finally elapses it does not spawn anything
//   itself; it ARMS a three-cell "delayed-event triple" that a downstream routine
//   (fireDelayedEventRequest, 0x15c3) later counts down to raise DELAYED_EVENT_REQUEST,
//   which spawnObjectsOnDelayedEvent (0x140c) consumes to launch the extra objects.
//
// ROLE IN THE MACHINE
//   Runs from the per-frame gameplay service cluster. Its whole job is to decide *when* the
//   next delayed spawn is due and *what* payload it carries. Two branches, chosen by the mode
//   flag loc_4006 bit0: a "fixed-arm" branch (mode clear) that arms a constant triple on a full
//   timer cascade, and a "derived" branch (mode set) that computes the payload from work-RAM.
//
// THE OUTPUT TRIPLE (the "delayed-event triple")
//   DELAYED_EVENT_TIMER (0x422f) — the countdown fireDelayedEventRequest ticks down.
//   loc_424a (0x424a)           — a companion counter written alongside it.
//   DELAYED_EVENT_ARMED (0x422e) — the arm flag; setting bit0 tells the consumer it is live.
//
// ROM 0x1555.  Grounding: [seen].
// LIVE-OUT: the three cells above (plus the timer cells loc_4245/loc_4246 it advances).
import {
  OBJ_ACTIVE_FLAG, loc_41ef, loc_422b, loc_4006, loc_4221,
  loc_4245, loc_4246, loc_4177, loc_421a, DELAYED_EVENT_TIMER, loc_424a, DELAYED_EVENT_ARMED,
} from "./names.js";

// The outer timer reloads to 60 frames (~1 second at 60Hz) on each wrap.
const OUTER_RELOAD = 60;

export function scheduleDelayedEvent(m) {
  const { mem8, mem16 } = m;

  // Three enable gates, all tested on bit 0. The object/AI subsystem must be enabled
  // (OBJ_ACTIVE_FLAG) and loc_41ef must be set, while the inhibit flag loc_422b must be
  // CLEAR. Any gate failing skips the whole tick, so the delayed event is frozen until the
  // playfield is in the right state.
  if (!(mem8[OBJ_ACTIVE_FLAG] & 0x01)) return;
  if (!(mem8[loc_41ef] & 0x01)) return;
  if (mem8[loc_422b] & 0x01) return;

  // Mode bit clear -> the fixed-arm path. Tick the outer timer, and only on its wrap tick the
  // inner one; the triple is armed to constants only when BOTH tiers cascade to zero on the
  // same frame — a rare, slow trigger.
  if (!(mem8[loc_4006] & 0x01)) {
    // Outer tier: decrement (with 8-bit wrap) and store; a nonzero result means not due yet.
    const outer = (mem8[loc_4245] - 1) & 0xff;
    mem8[loc_4245] = outer;
    if (outer !== 0) return;
    mem8[loc_4245] = OUTER_RELOAD;

    // Inner tier: only reached on an outer wrap. Decrement, store, and bail unless it too hits
    // zero; then reload the inner tier to 5.
    const inner = (mem8[loc_4246] - 1) & 0xff;
    mem8[loc_4246] = inner;
    if (inner !== 0) return;
    mem8[loc_4246] = 5;

    // Full cascade elapsed: arm the fixed delayed-event triple and finish.
    mem8[DELAYED_EVENT_TIMER] = 90;
    mem8[loc_424a] = 45;
    mem8[DELAYED_EVENT_ARMED] = 1;
    return;
  }

  // Mode bit set -> the derived path. Only the outer timer gates entry here; on its wrap the
  // payload is computed rather than taken as a constant.
  const outer = (mem8[loc_4245] - 1) & 0xff;
  mem8[loc_4245] = outer;
  if (outer !== 0) return;
  mem8[loc_4245] = OUTER_RELOAD;

  // Decide the payload byte `value`.
  let value;
  // If region-clear flag loc_4221 bit0 is set, the payload is simply 2 (short/immediate).
  if (mem8[loc_4221] & 0x01) {
    value = 2;
  } else {
    // Otherwise gate on the inner tier as well: decrement/store, bail unless zero, then reload
    // it to 1 so the derived branch retriggers every outer wrap.
    const inner = (mem8[loc_4246] - 1) & 0xff;
    mem8[loc_4246] = inner;
    if (inner !== 0) return;
    mem8[loc_4246] = 1; // restore the inner timer

    // c = low two bits of the byte-sum of the first word cell.
    // loc_4177 sits in the primary trigger block; folding its two bytes gives a small 0..3 index.
    const w1 = mem16[loc_4177];
    const c = ((w1 >> 8) + (w1 & 0xff)) & 0x03;

    // Second word cell's byte-sum; a zero sum aborts before any output is written.
    // loc_421a is the pace/difficulty counter; a zero fold means "nothing pending", so bail.
    const w2 = mem16[loc_421a];
    const sum = ((w2 >> 8) + (w2 & 0xff)) & 0xff;
    if (sum === 0) return;

    // Derive the payload: take bits 2..3 of the sum, complement, offset by 10, subtract c.
    // The result is also stashed back into the inner-timer cell as the next reload seed.
    value = ((~((sum >> 2) & 0x03) & 0xff) + 10 - c) & 0xff;
    mem8[loc_4246] = value;
  }

  // Fan the value into the output triple via left-rotations, then mark it ready.
  // The two timer cells get rotate-left-by-2 and rotate-left-by-3 copies of `value` (8-bit
  // rotations, matching the Z80 RLC pattern), and the arm flag is raised.
  mem8[DELAYED_EVENT_TIMER] = (value << 2) | (value >> 6);
  mem8[loc_424a] = (value << 3) | (value >> 5);
  mem8[DELAYED_EVENT_ARMED] = 1;
}
