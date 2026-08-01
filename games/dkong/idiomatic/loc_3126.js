// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3126 — caller-skip frame-throttle: proceed on three of every four frames.  ROM 0x3126.
 *
 * A leaf guard that reads the frame counter and returns a boolean the caller consumes as
 * an early return: `if (!loc_3126(m)) return;`. It proceeds (returns true) while the frame
 * counter's low two bits are NOT both set, and skips (returns false) on the one frame in
 * four where they are — so whatever the caller does behind this guard runs on three of
 * every four frames and pauses on the fourth.
 *
 * It is one arm of a difficulty-scaled throttle family (ROM 0x3110–0x313B). loc_30fa reads
 * DIFFICULTY, clamps it to 0..5, and dispatches to one of four sibling guards that let the
 * gated action run on a rising fraction of frames as difficulty climbs (one-half, five-
 * eighths, three-quarters, seven-eighths). This is the three-quarters arm, selected at
 * difficulty 3 and 4. The siblings differ only in which low bits they test and the value
 * they compare against, so copying one arm's mask/compare onto another silently inverts it
 * on some frames — the trap the teeth twins pin.
 *
 * In the raw form the skip is a two-level stack splice (it discards its own return address
 * so control lands in its caller's caller); the idiomatic form drops that entirely — the
 * Z80 stack is the JS call stack — and returns the decision as the boolean. The low-two-bit
 * mask and the compare value are genuine bit operations the behaviour depends on, so they
 * stay in hex.
 *
 * A LEAF — reads one byte, writes nothing, calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3126.test.js.
 * GATE:     exhaustive — the whole input is one byte, so all 256 FRAME values are swept vs
 *           the oracle's skip decision (a proof, not a sample), plus crafted entries on a
 *           real attract machine. The family is reached only through loc_30fa's untranslated
 *           rst-0x28 table, so attract never dispatches it (0 natural hits); the crafted
 *           entries stand in for real captured dispatches.
 * LIVE-OUT: memory-only (writes none) — the control-flow boolean is the whole output; the
 *           SP/PC/flags the oracle leaves are the dead Z80 return mechanism the JS return
 *           replaces.
 * NAMES:    FRAME (0x601A) from ram.js.
 */

import { FRAME } from "./ram.js";

export function loc_3126(m) {
  // Proceed on every frame except the one in four where the frame counter's low two bits
  // are both set; on that frame return false so the caller skips its remaining work.
  return (m.mem.read8(FRAME) & 0x03) !== 0x03;
}
