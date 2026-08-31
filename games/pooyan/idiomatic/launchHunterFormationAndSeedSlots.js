// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { fillByteRun } from "./fillByteRun.js";
import { queueSoundCommand0E } from "./queueSoundCommand0E.js";
import { scanDisplaySlotsAndTickBoardClear } from "./scanDisplaySlotsAndTickBoardClear.js";
import {
  FORMATION_SLOT_TABLE,
  HUNTER_LAUNCH_PARAM_TABLE,
  FRAME_TIMER_BLOCK_BASE,
  FORMATION_STATE,
  FORMATION_LAUNCH_VRAM_CLEAR,
  HUNTER_SCRIPT_PTR,
  HUNTER_SCRIPT_TABLE,
  SELFCHECK_ROUTINE_BASE_ADDR,
  TAMPER_COPY_3278,
  BONUS_AWARD_DSW,
} from "./names.js";
/**
 * launchHunterFormationAndSeedSlots — the "launch" state of the hunter-formation dispatcher.
 *
 * WHAT IT IS
 *   ROM 0x30f1-0x316d. This is state 0 of the three-way hunter-formation dispatcher reached
 *   through the formation dispatch table FORMATION_DISPATCH_TABLE (0x30eb): index 0 launches a
 *   fresh formation (here), index 1 is the swoop, index 2 is a code-integrity check. The
 *   formation-state dispatch runs once per active-play frame, and this state fires the single
 *   frame on which a new wave of hunters is committed to the field.
 *
 * ROLE IN THE MACHINE
 *   Pooyan's enemies arrive in coordinated formations. Launching one means giving each of the
 *   four formation slots its opening animation, screen coordinate and sprite tiles; starting
 *   the wave's frame timer so the formation begins to move; clearing the little region of the
 *   playfield the formation is about to occupy; pointing the formation's behaviour script at
 *   its opening script; and announcing the launch with a sound. The routine then closes with an
 *   anti-tamper self-check that guards the game's code image.
 *
 * GROUNDING: [seen]
 *
 * LIVE-OUT (what it leaves in memory):
 *   - four formation-slot records seeded: field +4 (anim), +6 (coord), +0x0f / +0x10 (tile
 *     pair) from the parameter table, and field +9 = 0x30 (a fixed frame delay);
 *   - FRAME_TIMER_BLOCK_BASE (0x8928) = 0x0c — the wave's frame timer, primed;
 *   - FORMATION_STATE (0x8f08) incremented by one — the dispatcher advances off "launch";
 *   - a 3x3 tile block at 0x84c2 flooded with the blank tile 0x10;
 *   - HUNTER_SCRIPT_PTR (0x8f4b) = HUNTER_SCRIPT_TABLE (0x3370) — the formation's opening script;
 *   - one sound command queued;
 *   - on a failed self-check ONLY: work RAM from BONUS_AWARD_DSW (0x8800) upward wiped to zero.
 *   No register result is consumed by the caller.
 */

const SLOT_COUNT = 0x04; //    formation slots seeded
const FRAME_DELAY = 0x30; //   per-slot delay written to record+9
const REC_ANIM = 0x04; //      record field <- param byte 0
const REC_COORD = 0x06; //     record field <- param byte 1
const REC_TILE_A = 0x0f; //    record field <- param byte 2
const REC_TILE_B = 0x10; //    record field <- param byte 3
const REC_DELAY = 0x09; //     record field <- FRAME_DELAY
const WAVE_TIMER_SEED = 0x0c; // value primed into the frame-timer block
const TILE_BLANK = 0x10; //    blank tile flooded into the video block
const BLANK_ROWS = 0x03; //    rows in the cleared block
const BLANK_WIDTH = 0x03; //   tiles per row cleared
const ROW_REMAINDER = 0x1d; // step from a row's end to the next row start (net +0x20)
const CMP_LEN = 0x40; //       body bytes compared by the self-check

export function launchHunterFormationAndSeedSlots(m) {
  const { mem8, mem16 } = m;

  // STEP 1 — seed the four formation-slot records.
  //   FORMATION_SLOT_TABLE (0x8920) is a table of four 2-byte pointers, one per formation slot;
  //   each points at that slot's object record elsewhere in the object page. The parameter table
  //   HUNTER_LAUNCH_PARAM_TABLE (0x3337) holds four bytes per slot. For each slot we dereference
  //   its pointer to reach the record, then write the four parameter bytes into the record's
  //   animation (+4), coordinate (+6) and tile-pair (+0x0f / +0x10) fields, plus a fixed 0x30
  //   frame delay into +9. Both cursors then step to the next slot: the pointer table by two
  //   bytes (one pointer) and the parameter table by four (one slot's worth of bytes).
  let entry = FORMATION_SLOT_TABLE;
  let param = HUNTER_LAUNCH_PARAM_TABLE;
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const rec = mem8[entry] | (mem8[u16(entry + 1)] << 8);
    mem8[u16(rec + REC_ANIM)] = mem8[param];
    mem8[u16(rec + REC_COORD)] = mem8[u16(param + 1)];
    mem8[u16(rec + REC_TILE_A)] = mem8[u16(param + 2)];
    mem8[u16(rec + REC_TILE_B)] = mem8[u16(param + 3)];
    mem8[u16(rec + REC_DELAY)] = FRAME_DELAY;
    entry = u16(entry + 2);
    param = u16(param + 4);
  }

  // STEP 2 — start the wave and advance the dispatcher.
  //   FRAME_TIMER_BLOCK_BASE (0x8928) is the formation's frame timer; seeding it to 0x0c starts
  //   the wave's paced movement. Bumping FORMATION_STATE (0x8f08) advances the hunter-formation
  //   dispatcher off state 0, so subsequent frames run the swoop rather than re-launching.
  mem8[FRAME_TIMER_BLOCK_BASE] = WAVE_TIMER_SEED;
  mem8[FORMATION_STATE] = (mem8[FORMATION_STATE] + 1);

  // STEP 3 — blank the playfield region the formation will occupy.
  //   Starting at video-RAM cell FORMATION_LAUNCH_VRAM_CLEAR (0x84c2), flood a 3x3 tile block
  //   with the blank tile 0x10. fillByteRun writes three tiles and leaves the cursor just past
  //   them; adding ROW_REMAINDER (0x1d) then carries the cursor to the same column one row down
  //   (3 written + 0x1d = 0x20, exactly one 32-tile row), so each pass clears the next row.
  let cell = FORMATION_LAUNCH_VRAM_CLEAR;
  for (let row = 0; row < BLANK_ROWS; row++) {
    cell = fillByteRun(m, cell, TILE_BLANK, BLANK_WIDTH);
    cell = u16(cell + ROW_REMAINDER);
  }

  // STEP 4 — point the formation's behaviour script at its opening script.
  //   HUNTER_SCRIPT_PTR (0x8f4b) is the live cursor the formation interpreter follows; seating
  //   HUNTER_SCRIPT_TABLE (0x3370) there arms the formation's launch script.
  mem16[HUNTER_SCRIPT_PTR] = HUNTER_SCRIPT_TABLE;

  // STEP 5 — announce the launch, then sweep the display slots.
  //   queueSoundCommand0E appends the fixed launch sound (byte 0x0e) to the sound command ring.
  //   scanDisplaySlotsAndTickBoardClear then runs the per-slot return/board-clear tick over the
  //   display slots starting just past the four formation pointers (FORMATION_SLOT_TABLE + 8);
  //   passing 0 as the count makes it a full 256-slot sweep.
  queueSoundCommand0E(m);
  scanDisplaySlotsAndTickBoardClear(m, u16(FORMATION_SLOT_TABLE + 8), 0); // IX past the 4 slots, B=0 -> a full 256-slot sweep

  // STEP 6 — anti-tamper self-check on the game's code image.
  //   The copy that begins at TAMPER_COPY_3278 (0x3278) is a shadow of the checksum routine at
  //   SELFCHECK_ROUTINE_BASE_ADDR (0x68ac): a two-byte pointer header holding the value 0x68ac,
  //   followed by CMP_LEN (0x40) body bytes duplicating the routine's opening bytes. We verify
  //   the header low byte, then the header high byte, then walk all 0x40 body bytes against the
  //   master image at 0x68ac. Any divergence means the code image has been altered — a tamper.
  const orig = SELFCHECK_ROUTINE_BASE_ADDR;
  let src = orig;
  let ref = TAMPER_COPY_3278;
  let remaining = CMP_LEN;
  let tampered = false;
  if (mem8[ref] !== (orig & 0xff)) {
    tampered = true;
  } else if (mem8[u16(ref + 1)] !== (orig >> 8)) {
    tampered = true;
  } else {
    ref = u16(ref + 2);
    for (;;) {
      if (mem8[src] !== mem8[ref]) { tampered = true; break; }
      src = u16(src + 1);
      ref = u16(ref + 1);
      remaining = (remaining - 1) & 0xff;
      if (remaining === 0) break;
    }
  }
  if (!tampered) return; // image verified

  // STEP 7 — tamper response: scrub work RAM.
  //   A mismatch means the code image is not the shipped one, so the machine denies play by
  //   flooding work RAM with zero. The scrub runs from BONUS_AWARD_DSW (0x8800) upward for
  //   (remaining * 256) bytes — remaining being however many body bytes were still unchecked
  //   when the divergence was found — collapsing the game's live state.
  const wipeCount = remaining << 8;
  mem8[BONUS_AWARD_DSW] = 0;
  for (let i = 1; i <= wipeCount; i++) mem8[u16(BONUS_AWARD_DSW + i)] = 0;
}
