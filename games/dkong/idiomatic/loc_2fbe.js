// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2fbe — choose the object sprite's attribute for this frame's blink phase, then
 * commit the record.  ROM 0x2FBE.
 *
 * One of the build arms that tail into the shared object-sprite record write (loc_2f7c).
 * It reads the frame counter and, on the half of the counter's 16-frame cycle where its
 * bit 3 is set, forces the sprite's attribute byte to 1; on the other half it leaves the
 * caller's attribute untouched. Either way it then lays down the finished record through
 * loc_2f7c. The net effect is an every-8-frames flash of the sprite's colour attribute.
 * It is reached from the hammer updater only once the hammer timer has run most of its
 * course, so it reads as the hammer's about-to-expire warning flash [guess — the purpose
 * comes from the still-translated caller chain loc_2f43 / loc_2fb7; the mechanism here is
 * just "blink the attribute on the frame-counter phase"].
 *
 * The record's other inputs — destination address, object base, and tile code — pass
 * straight through to loc_2f7c untouched; this arm only selects the attribute. Those
 * inputs still arrive through the register file because loc_2f7c's callers are all the
 * translated oracle (the genuine boundary the pipeline permits); the hand-off dissolves
 * into honest parameters once the whole arm/updater chain is decompiled.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2fbe.test.js.
 * GATE:     captured + crafted. 0x2FBE is dispatched during attract (256 real dispatches
 *           / 4000 frames, BOTH blink phases, attribute 0x07 on entry — the live hammer
 *           flash), so captured dispatches cover the real path; crafted entries then pin
 *           BOTH blink phases against both object records, several pass-through attributes,
 *           and the 8-bit position wraps. Full RAM dump compared — neither this arm nor
 *           loc_2f7c writes the stack, so no exclusion. Teeth: an inverted blink phase, a
 *           wrong blink attribute, and a never-blink twin.
 * LIVE-OUT: memory-only. This arm tail-calls the record write and its own caller discards
 *           the result; the oracle's residual registers/flags and loc_2f7c's terminal
 *           return reach no consumer. The attribute is an input threaded into loc_2f7c.
 * NAMES:    FRAME (0x601A) from ram.js. The forced attribute value 1 and the blink-phase
 *           bit (bit 3) are local constants; loc_2f7c owns every record/object cell.
 */

import { FRAME } from "./ram.js";
import { loc_2f7c } from "./loc_2f7c.js"; // ROM 0x2F7C — the shared object-sprite record write

// Bit 3 splits the frame counter's 16-frame cycle into two 8-frame halves; the blink
// shows on the half where it is set.
const BLINK_PHASE_BIT = 0x08;
// Attribute forced onto the sprite record during the blink half.
const BLINK_ATTR = 1;

export function loc_2fbe(m) {
  const { regs, mem } = m;

  // On the blink half of the frame cycle, override the attribute loc_2f7c will store;
  // on the other half let the caller's attribute pass straight through.
  if ((mem.read8(FRAME) & BLINK_PHASE_BIT) !== 0) {
    regs.c = BLINK_ATTR;
  }

  // Commit the finished sprite record (destination, object base, and tile code arrive in
  // registers from the caller; the attribute is the byte selected just above).
  loc_2f7c(m);
}
