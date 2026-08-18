// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0292  —  ROM 0x0292  ·  grounding: [seen]
 *
 * WHAT IT IS
 *   The frog-spawn "ready delay" tick. Between the moment a frog is consumed (lost, drowned, or safely
 *   home) and the moment the next frog appears, the game holds the play field still for a short beat.
 *   That beat is timed by a single 16-bit countdown, INPLAY_COUNTDOWN_WORD (0x829d), seeded to 0x20
 *   (32 frames) at frog start by startNewGame. This routine is the one place that word is drained: each
 *   frame it counts the word down by one, and on the exact frame it hits zero it clears the expiry flag
 *   COUNTDOWN_EXPIRY_FLAG (0x83ae) to signal "the delay is over".
 *
 * WHERE IT SITS
 *   Called once per frame from the NMI in-play cascade, near the tail of the per-frame world step. The
 *   cascade WAITS on this word: while INPLAY_COUNTDOWN_WORD is non-zero the frog does not respawn and the
 *   normal play/collision loop is held off; only once it (and the two home-reveal timers) drain to zero
 *   does the NMI spawn the next frog and resume play. So this routine is the clock that releases the hold.
 *
 *   Note: this is the SPAWN delay, not the on-screen time bar. The time bar is driven separately from
 *   TIME_REMAINING_P1/P2 (0x83e5/0x83e6) — do not confuse the two countdowns.
 *
 * LIVE-OUT
 *   Memory only. It rewrites the countdown word and, on the drain frame, zeroes the expiry flag. It
 *   returns nothing and leaves no register the caller reads.
 */
import { INPLAY_COUNTDOWN_WORD, COUNTDOWN_EXPIRY_FLAG } from "./names.js";

export function loc_0292(m) {
  const { mem8, mem16 } = m;

  // ── Read the ready-delay word; do nothing once it has already drained ─────────────────
  // INPLAY_COUNTDOWN_WORD (0x829d) is a 16-bit cell, so it is read through mem16. A value of 0 means the
  // delay is finished (or no frog-spawn beat is pending) — there is nothing left to tick, and in
  // particular we must NOT touch the expiry flag again, since it is only meant to be cleared on the single
  // frame the count transitions to zero. Fall straight through.
  const count = mem16[INPLAY_COUNTDOWN_WORD];
  if (count === 0) return;

  // ── Tick the delay down by one frame ──────────────────────────────────────────────────
  // One frame of the ready delay has elapsed: decrement the word and store it back. Because we only reach
  // here when count is non-zero, next lands in [0, 0xfffe] and there is no 16-bit wrap to guard against.
  const next = count - 1;
  mem16[INPLAY_COUNTDOWN_WORD] = next;

  // ── On the frame it drains, release the hold ──────────────────────────────────────────
  // If this tick brought the word to exactly zero, the ready delay is over: clear the expiry flag
  // COUNTDOWN_EXPIRY_FLAG (0x83ae). Downstream the NMI cascade reads the drained state to spawn the next
  // frog and hand control back to the play/collision loop.
  if (next === 0) mem8[COUNTDOWN_EXPIRY_FLAG] = 0;
}
