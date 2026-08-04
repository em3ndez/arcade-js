// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3126 — caller-skip frame-throttle: proceed on three of every four frames.
 *
 * A leaf guard that reads FRAME and returns a boolean the caller consumes as an early return —
 * `if (!loc_3126(m)) return;`. It proceeds while FRAME's low two bits are NOT both set, and skips on
 * the one frame in four where they are, so whatever the caller does behind this guard runs on three
 * of every four frames and pauses on the fourth.
 *
 * It is one arm of a difficulty-scaled throttle family: a difficulty-clamped table picks one of four
 * sibling guards that let the gated action run on a rising fraction of frames as difficulty climbs
 * — one-half, five-eighths, three-quarters, seven-eighths. This is the three-quarters arm, selected
 * at difficulty 3 and 4. The siblings differ ONLY in which low bits they test and the value they
 * compare against, so copying one arm's mask or compare onto another silently inverts it on some
 * frames while agreeing on the rest.
 *
 * In the raw form the skip is a two-level stack splice — the guard discards its own return address
 * so control lands in its caller's caller. Here that is gone entirely and the decision IS the
 * boolean. The low-two-bit mask and the compare value are genuine bit operations the behaviour
 * depends on, so they stay in hex.
 *
 * A LEAF — reads one byte, writes nothing, calls nothing.
 *
 * Reads: FRAME. Writes: nothing.
 * LIVE-OUT: the proceed/skip boolean, and nothing else.
 */

import { FRAME } from "./names.js";

export function loc_3126(m) {
  // Proceed on every frame except the one in four where the frame counter's low two bits
  // are both set; on that frame return false so the caller skips its remaining work.
  return (m.mem.read8(FRAME) & 0x03) !== 0x03;
}
