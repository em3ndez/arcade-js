// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { PLAYER_SEGMENT, PLAYER_FINE_ANGLE, TARGET_SEG } from "./names.js";
import { primeTopPriorityObject } from "./primeTopPriorityObject.js";

/**
 * primeTopObjectOnTargetMatch -- spawn the top-priority object only when a slot's target lines up. ROM 0xa1e4.
 *
 * Role in the machine: this is the guarded spawn used when a shot slot retires (see stepActiveShots). A
 * new top-priority object is only worth inserting if the "live" segment the player currently faces
 * ($200) actually coincides with the target segment recorded for slot x ($2ad,x). It also refuses to
 * spawn if a prime is already pending, so two arrivals in the same frame do not double-insert.
 *
 * Behavior: reads PLAYER_SEGMENT ($200) and compares it against TARGET_SEG+x ($2ad,x); on a mismatch it
 * returns having done nothing. It then tests the ready flag PLAYER_FINE_ANGLE ($201) -- if bit 7 is
 * already set a prime is in flight, so it returns. Otherwise it runs primeTopPriorityObject(m, x, y) to
 * seat the fresh object, and latches the ready flag to 0x81 (bit 7 set plus the low marker) so the rest
 * of the frame sees the spawn as pending.
 *
 * Live-out: on the match path, everything primeTopPriorityObject writes (the new 8-slot table entry, its
 * head/type/source/target cells, the sound gate) plus PLAYER_FINE_ANGLE ($201) = 0x81. On a miss, no
 * state changes. Grounding: [seen].
 */
export function primeTopObjectOnTargetMatch(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  if (mem8[PLAYER_SEGMENT] !== mem8[u16(TARGET_SEG + x)]) return; // live segment must equal slot x's target
  if (mem8[PLAYER_FINE_ANGLE] & 0x80) return;                     // a prime is already pending -- bail
  primeTopPriorityObject(m, x, y);                                // seat the fresh top-priority object
  mem8[PLAYER_FINE_ANGLE] = 0x81;                                 // latch ready: bit7 pending + low marker
}
