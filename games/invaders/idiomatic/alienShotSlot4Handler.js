// SPDX-License-Identifier: GPL-3.0-only
import { copyRecordToWorkBuffer } from "./copyRecordToWorkBuffer.js";
import { stepAlienShot } from "./stepAlienShot.js";
import { copyWorkBufferToRecord } from "./copyWorkBufferToRecord.js";
import { blockCopy } from "./blockCopy.js";
import {
  ATTRACT_ANIM_ACK, loc_2046, loc_2070, loc_2036, loc_2071, loc_2076, loc_1b58,
  ALIEN_SHOT_BLOWUP_TIMER, loc_1b50, loc_2050, loc_2058,
} from "./names.js";

/**
 * alienShotSlot4Handler — the clean shared alien-shot step leaf.
 *
 * WHAT IT IS
 *   An object-table step handler for one alien shot. Once per frame it lifts the object's move-record
 *   into the shared scratch strip, stages the two per-column rate cells the shot stepper reads, steps
 *   the shot, clamps its firing-column cursor, then writes the record back — either restoring the
 *   in-flight strip while the shot is exploding, or re-seeding the record from its ROM template band.
 *
 * ROLE IN THE MACHINE
 *   This is the "clean leaf" the saucer handler shares: saucerHandler tail-calls it outside its own
 *   saucer-active window (mechanisms.md, object-record handlers). Its body (ROM loc_050f) is ALSO the
 *   fall-through target of the attract-demo object handler at 0x050e (a `pop h` entry one byte before
 *   it), so the credit/high-score reveal animation drives it too. What it touches:
 *     - the shared 11-byte work buffer loc_2073 (via copyRecordToWorkBuffer / copyWorkBufferToRecord),
 *       lifted from / restored to the record strip starting at 0x2055 (ATTRACT_ANIM_ACK = record+5);
 *     - the per-column rate cells loc_2070 / loc_2071, which stepAlienShot gates the shot cadence on,
 *       staged here from the record source cells loc_2046 / loc_2036 (roles not confidently grounded);
 *     - the firing-column cursor loc_2076, clamped against the ROM base loc_1b58;
 *     - the 16-byte ROM record template loc_1b50, block-copied into the record base loc_2050;
 *     - the blowup gate ALIEN_SHOT_BLOWUP_TIMER (0x2078), which selects the restore-vs-reseed path.
 *
 * ROM 0x050f.  Grounding: [seen].
 *
 * LIVE-OUT: memory only. On the blowup path it returns copyWorkBufferToRecord's result and the seam
 * completes the ret; on the normal path it falls off the end (an omitted-ret leaf).
 */
export function alienShotSlot4Handler(m) {
  // Lift the object's 11-byte move-record (starting at record+5 = 0x2055) into the shared work buffer
  // loc_2073 so the stepper can edit it in place; the per-call marker 0xdb is parked into loc_207f
  // (a scratch cell the stepper reads back — the meaning of 0xdb itself is not grounded).
  copyRecordToWorkBuffer(m, 0xdb, ATTRACT_ANIM_ACK);
  // Stage the two per-column rate cells stepAlienShot gates the shot's firing cadence on, copying them
  // from this record's source cells (loc_2046 -> loc_2070, loc_2036 -> loc_2071).
  m.mem8[loc_2070] = m.mem8[loc_2046];
  m.mem8[loc_2071] = m.mem8[loc_2036];
  // Run the shared alien-shot stepper: it gates on the raster draw-phase, runs the blowup animation,
  // descends the live shot one step and redraws it with collision, or launches a new shot from a column.
  stepAlienShot(m);
  // Wrap the firing-column cursor: once it reaches column 21 reset it to the ROM base at loc_1b58,
  // so the next shot picks a column from the front of the sweep again.
  if (m.mem8[loc_2076] >= 21) m.mem8[loc_2076] = m.mem8[loc_1b58];
  // While the shot is still exploding (blowup timer nonzero) leave the record's live strip untouched:
  // just copy the scratch strip back into the record (restore in place) and return.
  if (m.mem8[ALIEN_SHOT_BLOWUP_TIMER] !== 0) return copyWorkBufferToRecord(m, ATTRACT_ANIM_ACK);
  // Otherwise re-seed the record: blit the 16-byte ROM template band (loc_1b50) over the record base
  // (loc_2050), then stow the 16-bit firing-column word (loc_2076) into loc_2058 for the next pass.
  blockCopy(m, loc_1b50, loc_2050, 16);
  m.mem16[loc_2058] = m.mem16[loc_2076];
}
