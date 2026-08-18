// SPDX-License-Identifier: GPL-3.0-only
/**
 * tickGatedCountdown  —  ROM 0x1fc7  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The per-frame tick of the frog's *spawn input-lock*. When a fresh frog is seeded onto the board the
 *   reseed routine stampHomeGoalAndResetFrog (0x0292 chain) arms a short countdown — it loads
 *   GATED_COUNTDOWN_COUNTER (0x826a) with 0x20 (32 frames) and raises the enable flag
 *   GATED_COUNTDOWN_ENABLE_FLAG (0x826c) to 1. While that flag is up the frog cannot be steered at all:
 *   the input scanners fence off the joystick, so the newly-placed frog sits still for those ~32 frames
 *   before the player is handed control. This routine is the clock that runs that lock down — one tick
 *   per frame — and when the count reaches zero it drops the flag and control returns.
 *
 * WHERE IT SITS
 *   Called once per frame from the in-play world-step cascade (in company with advanceScrollLaneObjects,
 *   driveFrogDeathAnimation, driveSpriteObjectCluster, …). Its one output — the enable flag — is *read*
 *   by the two input scanners scanFrogInputAndDispatchHop (0x1acb) and driveAttractDemoFrogHop (0x236d),
 *   both of which return early ("input locked") while the flag is set. It is also the ONLY code that ever
 *   clears the flag; the reseed is the only code that sets it. On the vast majority of frames the flag is
 *   already clear and this routine falls straight through the first `return` without touching the counter.
 *
 * LIVE-OUT
 *   Memory only. It writes the countdown counter and, on expiry, clears the enable flag. It returns
 *   nothing and leaves no register the caller reads.
 */
import { GATED_COUNTDOWN_COUNTER, GATED_COUNTDOWN_ENABLE_FLAG } from "./names.js";

export function tickGatedCountdown(m) {
  const { mem8 } = m;

  // ── Gate: is the lock armed? ──────────────────────────────────────────────────────────
  // GATED_COUNTDOWN_ENABLE_FLAG (0x826c) is raised (to 1) only while a spawn lock is in progress — the
  // reseed sets it when it places a new frog, and this routine is the only thing that ever clears it.
  // Clear (0) therefore means no countdown is running, so there is nothing to tick: return without
  // reading or writing the counter. This is the common case, hit on almost every frame of steady play.
  if (mem8[GATED_COUNTDOWN_ENABLE_FLAG] === 0) return;

  // ── Tick: count one frame off the lock ────────────────────────────────────────────────
  // Decrement the frame counter GATED_COUNTDOWN_COUNTER (0x826a) and store it back. The `& 0xff`
  // reproduces the Z80's 8-bit wrap: the cell is a single byte, so 0x00 - 1 would wrap to 0xff. In normal
  // play the counter is seeded to 0x20 and is only reached with the flag set, so it never underflows —
  // but the mask keeps this byte-exact with the ROM regardless of how it is entered.
  const next = (mem8[GATED_COUNTDOWN_COUNTER] - 1) & 0xff;
  mem8[GATED_COUNTDOWN_COUNTER] = next;

  // ── Still counting? ───────────────────────────────────────────────────────────────────
  // Any non-zero value means the lock still has frames left to run. Leave the enable flag up so the input
  // scanners keep fencing off the joystick for another frame, and return.
  if (next !== 0) return;

  // ── Expiry: release the lock ──────────────────────────────────────────────────────────
  // The counter has hit zero: the spawn lock is over. Clear GATED_COUNTDOWN_ENABLE_FLAG (0x826c) so the
  // input scanners stop returning early — on the next frame the player (or, in the attract demo, the
  // autopilot driveAttractDemoFrogHop) regains control of the frog.
  mem8[GATED_COUNTDOWN_ENABLE_FLAG] = 0;
}
