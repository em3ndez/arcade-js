// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  HUNTER_SPAWN_SUBCOUNTER,
  HUNTER_SPAWN_SUBCOUNTER_VRAM,
  SUBSTATE_FIELD1_COUNTER,
  SUBSTATE_FIELD1_VRAM,
  SUBSTATE_FIELD2_VALUE,
  SUBSTATE_FIELD2_VRAM,
  SUBSTATE_FIELD3_VALUE,
  SUBSTATE_FIELD3_VRAM,
  SUBSTATE_FIELD3_HUNDREDS_VRAM,
  MAINLOOP_SUBSTATE_SELECTOR,
} from "./names.js";
import { binToPackedBcd } from "./binToPackedBcd.js";
import { drawStackedBcdDigits } from "./drawStackedBcdDigits.js";
import { queueSoundCommand13 } from "./queueSoundCommand13.js";

/**
 * paintSubstateHudDigitsAndAdvancePhase — main-loop sub-state 3: repaint the three
 * sub-state HUD BCD digit fields, then advance the phase and chirp.
 *
 * WHAT IT IS
 *   ROM 0x10a2-0x1118 · grounding: [seen]
 *   One handler in the ordinary play loop's six-way sub-state machine. The dispatcher picks
 *   it when MAINLOOP_SUBSTATE_SELECTOR (0x8f5c) masks to 3. Its whole job is to refresh the
 *   little on-screen digit read-outs that the scripted countdown phases keep updated, then
 *   step the selector so the next phase runs on the following pass.
 *
 * ROLE IN THE MACHINE
 *   Sub-states 2..5 are the "display" arm of the play loop: each does a small piece of work
 *   and hands the selector on. This one owns three stacked-digit fields that live in tile
 *   video RAM. It paints each field, keeps a shared field-1 counter in step, bumps the
 *   selector to advance the phase, and enqueues the phase chirp for the sound ring.
 *
 * THE THREE FIELDS (each drawn as two stacked BCD digit tiles, tens over units)
 *   Field 1  source HUNTER_SPAWN_SUBCOUNTER (0x8f5d)  ->  video RAM 0x8650
 *            The digit renderer only understands packed BCD, so a raw value >= 10 is packed
 *            first; smaller values are already one digit and pass through. A value of 1..11
 *            gets a re-centred SECOND draw: the value is mirrored about the middle of the
 *            range to (12 - value), stashed in SUBSTATE_FIELD1_COUNTER (0x8f62), doubled, and
 *            painted at 0x85d0. Values of 0 or >= 12 skip that second draw.
 *   Field 2  source SUBSTATE_FIELD2_VALUE (0x8f5e)    ->  video RAM 0x8652
 *            Same raw-or-packed draw of its own byte.
 *   Field 3  source SUBSTATE_FIELD3_VALUE (0x8f60)    ->  video RAM 0x85d2
 *            Painted only when nonzero. Its byte is folded into the field-1 counter (0x8f62),
 *            the byte is doubled and packed to BCD, a nonzero hundreds tally is latched to the
 *            hundreds cell 0x85f2, and the tens/units pair is painted.
 *
 * LIVE-OUT (memory only): the four HUD digit cells in video RAM (0x8650, 0x85d0, 0x8652,
 *   0x85d2, plus the 0x85f2 hundreds cell), SUBSTATE_FIELD1_COUNTER (0x8f62), and the bumped
 *   MAINLOOP_SUBSTATE_SELECTOR (0x8f5c); command byte 0x13 is enqueued for the sound ring. The
 *   tail's returned ring cursor is idiomatic-only, not load-bearing.
 */

const BCD_THRESHOLD = 0x0a; // values below this draw raw; at/above they pack to BCD first
const RECENTRE_LIMIT = 0x0c; // field-1 second draw only for values 1..11 (< this, nonzero)

export function paintSubstateHudDigitsAndAdvancePhase(m) {
  const { mem8 } = m;

  // Field 1 — HUNTER_SPAWN_SUBCOUNTER (0x8f5d). A raw value of 10 or more (the compare against
  // 0x0a at ROM 0x10a5) is packed to BCD before drawing; smaller values are already a single
  // digit and pass through unchanged. The two digits land at video RAM 0x8650 (ROM 0x10b0).
  const f1 = mem8[HUNTER_SPAWN_SUBCOUNTER];
  drawStackedBcdDigits(m, HUNTER_SPAWN_SUBCOUNTER_VRAM, f1 >= BCD_THRESHOLD ? binToPackedBcd(m, f1).a : f1);
  // A second, re-centred field is drawn only when the source is 1..11 (nonzero and below 0x0c;
  // the tests at ROM 0x10b6/0x10b9). The value is mirrored about the middle of the range to
  // (12 - value) and stashed in the shared SUBSTATE_FIELD1_COUNTER (0x8f62, ROM 0x10d1) — the
  // field-3 fold below reads it back — then doubled and packed to BCD and painted at video RAM
  // 0x85d0 (ROM 0x10d9). Values of 0 or >= 12 leave this field untouched.
  if (f1 !== 0 && f1 < RECENTRE_LIMIT) {
    const centred = RECENTRE_LIMIT - f1;
    mem8[SUBSTATE_FIELD1_COUNTER] = centred;
    drawStackedBcdDigits(m, SUBSTATE_FIELD1_VRAM, binToPackedBcd(m, centred << 1).a);
  }

  // Field 2 — SUBSTATE_FIELD2_VALUE (0x8f5e). Same rule as field 1: pack to BCD when the value
  // is 10 or more (the compare at ROM 0x10e2), otherwise draw the raw digit. Painted at video
  // RAM 0x8652 (ROM 0x10ea).
  const f2 = mem8[SUBSTATE_FIELD2_VALUE];
  drawStackedBcdDigits(m, SUBSTATE_FIELD2_VRAM, f2 >= BCD_THRESHOLD ? binToPackedBcd(m, f2).a : f2);

  // Field 3 — SUBSTATE_FIELD3_VALUE (0x8f60), painted only when present (the test at ROM
  // 0x10f4). Its byte is accumulated into the shared field-1 counter at 0x8f62 (ROM
  // 0x10fa-0x10fb), then the byte is doubled and packed to BCD (ROM 0x10fe). If that produced a
  // hundreds carry, the hundreds digit is latched into its own video-RAM cell 0x85f2 (ROM
  // 0x1107); the tens/units pair is painted at video RAM 0x85d2 (ROM 0x110e).
  const f3 = mem8[SUBSTATE_FIELD3_VALUE];
  if (f3 !== 0) {
    mem8[SUBSTATE_FIELD1_COUNTER] = u8(f3 + mem8[SUBSTATE_FIELD1_COUNTER]);
    const { a: packed, hundreds } = binToPackedBcd(m, u8(f3 << 1));
    if (hundreds !== 0) mem8[SUBSTATE_FIELD3_HUNDREDS_VRAM] = hundreds;
    drawStackedBcdDigits(m, SUBSTATE_FIELD3_VRAM, packed);
  }

  // Advance the phase: bump MAINLOOP_SUBSTATE_SELECTOR (0x8f5c, ROM 0x1114) so the dispatcher
  // runs the next sub-state on the following pass, and enqueue command byte 0x13 into the
  // sound-command ring as the phase chirp (ROM 0x1115).
  mem8[MAINLOOP_SUBSTATE_SELECTOR] = u8(mem8[MAINLOOP_SUBSTATE_SELECTOR] + 1);
  return queueSoundCommand13(m);
}
