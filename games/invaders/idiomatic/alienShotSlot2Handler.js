// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { copyRecordToWorkBuffer } from "./copyRecordToWorkBuffer.js";
import { stepAlienShot } from "./stepAlienShot.js";
import { copyWorkBufferToRecord } from "./copyWorkBufferToRecord.js";
import { blockCopy } from "./blockCopy.js";
import {
  loc_1b32, loc_2032, loc_2038, loc_2035, loc_2046, loc_2070, loc_2056, loc_2071,
  ALIEN_SHOT_BLOWUP_TIMER, loc_2030, loc_1b30,
} from "./names.js";

/**
 * alienShotSlot2Handler — the record-2 alien-shot object handler.
 *
 * WHAT IT IS
 *   One of the five per-frame object handlers the game seeds into GAME_OBJECT_TABLE (0x2010). This is
 *   the handler for object record 2, whose 16-byte record lives at loc_2030 (0x2030). It drives one of
 *   the aliens' descending shots: each frame it either skips the record (while its re-fire gate is
 *   still counting) or lifts the record's descriptor into the shared scratch strip, steps the shot,
 *   and writes the record back — restoring the working strip while the shot is mid-explosion, or
 *   re-seeding the whole record from its ROM template otherwise. The specific Space Invaders shot type
 *   this slot drives (rolling / plunger / squiggly) is not derivable from the code (pending §5 grounding).
 *
 * ROLE IN THE MACHINE
 *   Called by the object-table walker (walkObjectTable), which reads the handler address each record
 *   carries and calls it with the record pointer. It shares the alien-shot step body stepAlienShot
 *   (0x0563) with the slot-3 and slot-4 handlers; the difference between slots is which record cells it
 *   touches. It refreshes a control byte at loc_2032 from the ROM template byte loc_1b32; gates on a
 *   16-bit word at loc_2038; primes/restores the 11-byte descriptor strip at loc_2035 through the shared
 *   work buffer (copyRecordToWorkBuffer / copyWorkBufferToRecord); stages the two per-column shot-rate
 *   cells loc_2046/loc_2056 into loc_2070/loc_2071 for stepAlienShot to read; reads ALIEN_SHOT_BLOWUP_TIMER
 *   (0x2078) to learn whether the shot is exploding; and reseeds the record from the ROM template at
 *   loc_1b30 (0x1b30) via blockCopy.
 *
 * ROM 0x0476-0x04b5.  Grounding: [seen] (ALIEN_SHOT_SLOT2_HANDLER_ADDR is [seen]).
 *
 * LIVE-OUT: memory (the record at 0x2030.. and the shot's video output). No register contract; the
 * dispatcher's return address the ROM `pop h` discards is a dead value the body overwrites.
 */
export function alienShotSlot2Handler(m) {
  // Refresh the record's control byte (loc_2032, rec2+2) from the fixed ROM template byte loc_1b32
  // (template+2) every pass, so the record always starts from the template's control value.
  m.mem8[loc_2032] = m.mem8[loc_1b32];
  // The 16-bit gate word loc_2038 (rec2+8) decides whether the shot steps this pass. Read it once.
  const countdown = m.mem16[loc_2038];
  // While the gate reads zero the shot is dormant: wrap the word (0 - 1 = 0xffff) back into the record
  // and return without stepping. Once the word is nonzero the handler falls through and runs the shot.
  if (countdown === 0) { m.mem16[loc_2038] = u16(countdown - 1); return; }
  // Prime the shared 11-byte work buffer (loc_2073) from this record's descriptor strip at loc_2035
  // (rec2+5). The first argument 0xf9 is the accumulator value copyRecordToWorkBuffer parks into its
  // scratch cell loc_207f (stepAlienShot reads it back), so the copy loop cannot clobber it.
  copyRecordToWorkBuffer(m, 0xf9, loc_2035);
  // Stage the two per-column alien-shot rate cells (loc_2046, loc_2056) into loc_2070/loc_2071 — the
  // cells stepAlienShot reads to decide this slot's firing cadence.
  m.mem8[loc_2070] = m.mem8[loc_2046];
  m.mem8[loc_2071] = m.mem8[loc_2056];
  // Run the shared alien-shot step on the primed strip: gate to the matching raster half, run the
  // blowup animation while it is exploding, else descend one step, redraw with collision, and retire
  // across the shield/ground bands or launch a fresh shot from a firing column.
  stepAlienShot(m);
  // If the shot is mid-explosion (ALIEN_SHOT_BLOWUP_TIMER 0x2078 nonzero), write the edited working
  // strip back into the record so the blowup animation persists across frames.
  if (m.mem8[ALIEN_SHOT_BLOWUP_TIMER] !== 0) return copyWorkBufferToRecord(m, loc_2035);
  // Otherwise reseed the entire 16-byte record from its ROM template (loc_1b30 -> loc_2030), returning
  // the record to its template state for the next launch cycle.
  blockCopy(m, loc_1b30, loc_2030, 16);
}
