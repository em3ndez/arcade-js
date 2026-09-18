// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b51 — a reject exit of the player-vs-tilemap probe cascade: unwind two levels, skipping
 * the follow-up an accepted probe would have run. It carries no computation — returning false is
 * the caller-skip signal, propagated up as `if (!callee(m)) return;` through the probe and the
 * routine that ran it. The boolean is always false (unconditional skip), so the machine handle is
 * unread. A leaf: reads nothing, writes nothing, calls nothing.
 */
export function loc_2b51(m) {
  return false;
}
