// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepInitialDown — step a caller's bounded cyclic index down one notch and request sound 8.  ROM 0x4f26.
 *
 * The caller hands in the current value of a small cyclic index and reads the stepped
 * value back. The index has a live range of 10..35 plus a single "off / not engaged"
 * sentinel (255). Every call first asks for sound 8 to play (an unconditional feedback
 * request), then moves the index one step down:
 *
 *   - From the off sentinel, stepping down re-enters the range at its top (35).
 *   - Within the range, it just drops by one.
 *   - Stepping past the bottom of the range — to the floor at 9 — turns the index off
 *     (back to the 255 sentinel).
 *
 * This is the down counterpart of the sibling that steps the same index up. What the
 * index ultimately selects is not yet pinned down, so the routine keeps its address name.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4f26.test.js.
 * GATE:     crafted-entry — 0x4f26 is never dispatched in boot/attract (a probe over
 *           3000 frames sees 0), so the gate runs it from a real captured sound-request
 *           state (a sibling sound stub's entry, which never calls back into 0x4f26) and
 *           sweeps the index EXHAUSTIVELY over all 256 inputs, across every ring write
 *           pointer 0..7. Teeth catch a wrong-sound twin (RAM) and a wrong-step twin
 *           (returned index).
 * LIVE-OUT: memory + the returned index — the sound request fills a ring slot and
 *           advances the write pointer (owned by the shared enqueue), and the stepped
 *           index is the value the caller reads back. The oracle's other exit registers,
 *           flags, and Z80 return path are dead scratch a plain JS call/return replaces.
 * NAMES:    none directly — the sound request delegates to requestSound8, which owns the
 *           ring addresses.
 */
import { requestSound8 } from "./requestSound8.js";

const OFF = 255; // the "not engaged" sentinel the index parks at when off
const TOP = 35; // top of the live index range
const FLOOR = 9; // stepping to or past this floor (below the range's bottom, 10) turns the index off

export function stepInitialDown(m, index) {
  // The feedback sound is requested on every call, before the index moves.
  requestSound8(m);

  // From off, stepping down re-enters the range at the top.
  if (index === OFF) return TOP;

  // Otherwise drop one step; falling to the floor turns the index off.
  const stepped = index - 1;
  return stepped > FLOOR ? stepped : OFF;
}
