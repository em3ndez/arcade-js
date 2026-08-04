// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b51 — a reject exit of the player-vs-tilemap probe cascade: abandon the probe
 * and unwind two levels, skipping the follow-up an accepted probe would have run.
 *
 * The collision probe above this routine reaches here on its "no hit / reject"
 * outcomes. This routine carries no computation of its own: its whole job is to hand
 * control back two levels up — to whoever started the probe — WITHOUT running the
 * follow-up work that a normal, accepted probe result goes on to reach.
 *
 * That two-level return IS the caller-skip: return false, and each caller propagates
 * it as `if (!callee(m)) return;` — the probe returns false, the routine that ran the
 * probe early-returns, and control lands back at the level above that. The boolean is
 * always false here (an unconditional skip), so the machine handle is taken only for
 * uniformity with the rest of the caller-skip family and is otherwise unread.
 *
 * A LEAF — reads nothing, writes nothing, calls nothing.
 *
 * LIVE-OUT: the caller-skip boolean, always false. No memory is written.
 */

/**
 * @param {object} m  the machine handle (unread — the skip is unconditional).
 * @returns {boolean} always false: the caller-skip signal that unwinds the cascade.
 */
export function loc_2b51(m) {
  // Unconditional caller-skip: return the skip signal so the probe and the routine
  // that ran it both unwind. No inputs, no side effects.
  return false;
}
