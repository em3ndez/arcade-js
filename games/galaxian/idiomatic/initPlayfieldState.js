// SPDX-License-Identifier: GPL-3.0-only

/**
 * initPlayfieldState — sub-state-0 initialisation of a fresh play field.
 *
 * WHAT IT IS
 *   The first sub-state of a play round: it wipes the object/formation work-RAM back to a clean slate,
 *   turns the two start-button lamps off, seeds the sequence bookkeeping, and aims the VRAM fill cursor at
 *   the top of the tilemap so the following sub-states can paint the board. It does no drawing itself; it
 *   only clears memory and sets the cells the rest of the round reads.
 *
 * ROLE IN THE MACHINE
 *   Dispatched off SEQUENCE_STATE by the per-player play driver (runPlayerOnePlayFrame state 3 /
 *   runPlayerTwoPlayFrame state 4). Advancing SEQUENCE_STATE at the end hands the machine to the next
 *   sub-state, and arming the dwell timer holds it there for a beat. Writes work-RAM spans 0x4100-0x417f,
 *   0x4200-0x422f (in two runs with the 0x4217 gap between them), and 0x4260-0x42a5; sets FRAME_COUNTER
 *   (0x425f) and loc_4226; bumps SEQUENCE_STATE (0x400a); arms dwell loc_4009; loads VRAM_WRITE_PTR (0x400b).
 *
 * ROM 0x0550.  Grounding: [seen].
 */
import {
  START_LAMP_0,
  START_LAMP_1,
  FLAG_BITS_BASE,
  FRAME_COUNTER,
  OBJ_ACTIVE_FLAG,
  loc_4218,
  loc_4226,
  loc_4260,
  SEQUENCE_STATE,
  loc_4009,
  VRAM_WRITE_PTR,
  VRAM_BASE,
} from "./names.js";

// Dwell held on this sub-state after the bump, before the next one runs (arms loc_4009).
const DWELL_TIMER_START = 32;

export function initPlayfieldState(m) {
  const { mem8, mem16 } = m;

  // Both start-button lamps off — a play round is under way, not attract, so nothing is invited to start.
  mem8[START_LAMP_0] = 0;
  mem8[START_LAMP_1] = 0;

  // Zero the standing-formation flag block (0x4100-0x417f): 128 one-byte cells, one per grid cell.
  for (let i = 0; i < 128; i++) mem8[FLAG_BITS_BASE + i] = 0;
  // Reset the per-frame counter that paces the object-grid draw phase.
  mem8[FRAME_COUNTER] = 0;
  // Clear the object active-flag / launch-bookkeeping spans 0x4200-0x422f. The ROM does it as two runs —
  // 23 bytes from OBJ_ACTIVE_FLAG then 24 from loc_4218 — leaving the 0x4217 cell untouched between them.
  for (let i = 0; i < 23; i++) mem8[OBJ_ACTIVE_FLAG + i] = 0; // two spans with a one-byte gap between them
  for (let i = 0; i < 24; i++) mem8[loc_4218 + i] = 0;
  // Clear the object working-state block 0x4260-0x42a5 (70 bytes).
  for (let i = 0; i < 70; i++) mem8[loc_4260 + i] = 0;

  // Seed the sub-state's control cells, advance the sequence, arm the dwell, and point the fill cursor:
  //   loc_4226 = 1       raise the sub-state's live flag
  //   SEQUENCE_STATE++   hand the machine to the next sub-state
  //   loc_4009 = 32      hold there for DWELL_TIMER_START ticks
  //   VRAM_WRITE_PTR     aim the VRAM fill cursor at the tilemap base (0x5000)
  mem8[loc_4226] = 1;
  mem8[SEQUENCE_STATE]++;
  mem8[loc_4009] = DWELL_TIMER_START;
  mem16[VRAM_WRITE_PTR] = VRAM_BASE;
}
