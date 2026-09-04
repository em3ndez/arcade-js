// SPDX-License-Identifier: GPL-3.0-only
import { copyRecordToWorkBuffer } from "./copyRecordToWorkBuffer.js";
import { stepAlienShot } from "./stepAlienShot.js";
import { copyWorkBufferToRecord } from "./copyWorkBufferToRecord.js";
import { blockCopy } from "./blockCopy.js";
import { loc_067e } from "./loc_067e.js";
import {
  ALIEN_SHOT_SLOT3_DISABLE_FLAG, loc_2080, ALIEN_SHOT_SLOT3_DESC, loc_2036, ALIEN_SHOT_RATE_GATE0, loc_2056, ALIEN_SHOT_RATE_GATE_1, ALIEN_SHOT_COLUMN_CURSOR,
  ALIEN_SHOT_COLUMN_CURSOR_RESET, ALIEN_SHOT_BLOWUP_TIMER, ALIEN_SHOT_SLOT3_RECORD, ALIEN_SHOT_SLOT3_TEMPLATE, ALIEN_COUNT,
} from "./names.js";

/**
 * alienShotSlot3Handler — the record-3 (slot 3) alien-shot object step handler.
 *
 * WHAT IT IS
 *   One of the five per-frame object handlers the object-table walker dispatches. Each object record in
 *   GAME_OBJECT_TABLE (0x2010) names a fixed handler address at rec+3/rec+4; when the record's frame
 *   timer and gate byte both drain, the walker calls that handler. This is the slot-3 alien shot: the
 *   one whose firing column is managed by a column cursor, that clamps that cursor at 16, and that
 *   self-disables once a single alien is left on the board. (The specific Space Invaders shot type it
 *   drives — rolling / plunger / squiggly — is not derivable from the code.)
 *
 * ROLE IN THE MACHINE
 *   Called by walkObjectTable (ROM entry ALIEN_SHOT_SLOT3_HANDLER_ADDR = 0x04b6) once this record's
 *   timers expire. It shares the alien-shot machinery with alienShotSlot2Handler and the leaf
 *   alienShotSlot4Handler: it lifts the record's 11-byte descriptor strip into the shared work buffer
 *   (OBJECT_WORK_BUFFER) via copyRecordToWorkBuffer, stages the two per-column shot-rate cells (ALIEN_SHOT_RATE_GATE0/ALIEN_SHOT_RATE_GATE_1)
 *   that stepAlienShot consults, steps the shot, then either restores the strip mid-blowup or blits the
 *   record's ROM template band back into place. RAM it touches: its gate cell ALIEN_SHOT_SLOT3_DISABLE_FLAG, the shared
 *   cell loc_2080 (role ungrounded), the firing-column cursor ALIEN_SHOT_COLUMN_CURSOR, the blowup timer ALIEN_SHOT_BLOWUP_TIMER
 *   (0x2078), and ALIEN_COUNT (0x2082, the live-alien tally countLiveAliens publishes). ROM it reads: the
 *   descriptor source ALIEN_SHOT_SLOT3_DESC, the cursor-reset default ALIEN_SHOT_COLUMN_CURSOR_RESET, and the record template ALIEN_SHOT_SLOT3_TEMPLATE.
 *
 * ROM 0x04b6.  Grounding: [seen].
 *
 * LIVE-OUT: RAM only on the two early gate returns and the mid-blowup restore path; on the main path it
 * tail-calls loc_067e, which stores the column word (ALIEN_SHOT_COLUMN_CURSOR) into loc_2048.
 */
export function alienShotSlot3Handler(m) {
  // Self-disable gate. ALIEN_SHOT_SLOT3_DISABLE_FLAG is latched to 1 further down once the fleet is reduced to a single
  // alien; while it reads nonzero this shot no longer runs at all.
  if (m.mem8[ALIEN_SHOT_SLOT3_DISABLE_FLAG] !== 0) return;
  // Second gate on loc_2080, a shared cell serviceVblankObjects copies forward from loc_2032 each frame
  // (its exact role is not confidently recovered); the slot-3 shot only steps when it reads exactly 1.
  if (m.mem8[loc_2080] !== 1) return;
  // Prime the record's strip: stash A = 0xed into the scratch cell ALIEN_SHOT_SPRITE_FRAME_CEILING, then block-copy the
  // 11-byte descriptor strip from this record's source (ALIEN_SHOT_SLOT3_DESC) into the shared work buffer OBJECT_WORK_BUFFER,
  // where the shot stepper does its in-place editing.
  copyRecordToWorkBuffer(m, 0xed, ALIEN_SHOT_SLOT3_DESC);
  // Stage the two per-column shot-rate cells stepAlienShot reads to decide this shot's cadence: copy the
  // record's rate bytes (loc_2036, loc_2056) into the shared rate slots (ALIEN_SHOT_RATE_GATE0, ALIEN_SHOT_RATE_GATE_1).
  m.mem8[ALIEN_SHOT_RATE_GATE0] = m.mem8[loc_2036];
  m.mem8[ALIEN_SHOT_RATE_GATE_1] = m.mem8[loc_2056];
  // Step the alien shot: draw-phase gate, blowup animation, descend-one-step / redraw-with-collision, or
  // (when idle) launch a new shot from a firing column — all driven off the primed work buffer.
  stepAlienShot(m);
  // Clamp the firing-column cursor. ALIEN_SHOT_COLUMN_CURSOR walks across the fleet's columns; once it reaches 16 it is
  // wrapped back to the ROM-seeded start value in ALIEN_SHOT_COLUMN_CURSOR_RESET so the cursor stays inside the grid.
  if (m.mem8[ALIEN_SHOT_COLUMN_CURSOR] >= 16) m.mem8[ALIEN_SHOT_COLUMN_CURSOR] = m.mem8[ALIEN_SHOT_COLUMN_CURSOR_RESET];
  // Mid-blowup: while the shot's terminal-blowup timer (ALIEN_SHOT_BLOWUP_TIMER 0x2078) is still
  // running, write the edited strip straight back into the record (ALIEN_SHOT_SLOT3_DESC) and stop — no template
  // repaint while the blowup frames play out.
  if (m.mem8[ALIEN_SHOT_BLOWUP_TIMER] !== 0) return copyWorkBufferToRecord(m, ALIEN_SHOT_SLOT3_DESC);
  // Otherwise blit the record's fixed template band: copy 16 bytes from the ROM template ALIEN_SHOT_SLOT3_TEMPLATE into
  // the record's live area at ALIEN_SHOT_SLOT3_RECORD, restoring the record to its canonical layout for the next pass.
  blockCopy(m, ALIEN_SHOT_SLOT3_TEMPLATE, ALIEN_SHOT_SLOT3_RECORD, 16);
  // Last-alien self-disable: when countLiveAliens has driven ALIEN_COUNT (0x2082) down to exactly one,
  // latch this shot's gate cell ALIEN_SHOT_SLOT3_DISABLE_FLAG so the top-of-routine guard retires it for the rest of the wave.
  if (m.mem8[ALIEN_COUNT] === 1) m.mem8[ALIEN_SHOT_SLOT3_DISABLE_FLAG] = 1;
  // Publish the firing-column word: loc_067e stores the 16-bit value read from ALIEN_SHOT_COLUMN_CURSOR into loc_2048.
  return loc_067e(m, m.mem16[ALIEN_SHOT_COLUMN_CURSOR]);
}
