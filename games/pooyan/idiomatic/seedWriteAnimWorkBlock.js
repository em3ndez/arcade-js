// SPDX-License-Identifier: GPL-3.0-only
import { u16, u8 } from "../../../core/int.js";
import {
  ACTIVE_PLAYER,
  CABINET_MODE_FLAG,
  HIGH_SCORE_INSERT_RANK,
  ANIM_WORK_BLOCK_PTR,
  DISPLAY_LIST_VRAM_TILE,
  INPUT_PORT1,
  INPUT_PORT2,
  WRITE_ANIM_RECORD_ANCHOR,
  loc_8e21,
  WRITE_ANIM_TILE_INDEX,
  WRITE_ANIM_STEP_DELAY,
  WRITE_ANIM_ROW_COUNT,
  WRITE_ANIM_HANDLER_SELECT,
  WRITE_ANIM_WRITE_PTR,
  WRITEANIM_COUNTDOWN,
  FIRE_PHASE_SEED,
} from "./names.js";

/**
 * seedWriteAnimWorkBlock — write-anim state 0: seed the animation work block for a new high-score entry. [seen]
 *
 * ROM 0x7eb2-0x7f0d. First of three handlers the write-anim state machine steps through; a leaf,
 * calling nothing.
 *
 * WHAT "WRITE-ANIM" IS. When a player earns a place on the high-score table, the game plays a short
 * animation that draws their score into the table row, tile by tile. That animation is driven by a
 * small work block in RAM at 0x8e1f..0x8e2b, and WRITE_ANIM_HANDLER_SELECT (0x8e26) picks which of
 * three per-frame handlers runs. This routine is the SETUP handler (state 0): it builds the work
 * block from scratch, then hands control to the stepping handler by setting the selector to 1.
 *
 * WHAT DRIVES THE LAYOUT. HIGH_SCORE_INSERT_RANK (0x89fc) holds the winning rank plus one — how far
 * down the table the new entry sits. Both of this routine's walks use it as a pass count so the
 * seeded pointers land on the row for this rank:
 *   - The RECORD walk starts at WRITE_ANIM_RECORD_ANCHOR (0x8dfd, a base-minus-one anchor) and steps
 *     +3 per pass, so ANIM_WORK_BLOCK_PTR (0x8e1f) ends at 0x8dfd + 3*rank — the three-byte record
 *     for this rank.
 *   - The STAMP walk starts at the tilemap cell DISPLAY_LIST_VRAM_TILE (0x8565) and steps +2 per
 *     pass, so WRITE_ANIM_WRITE_PTR (0x8e27) ends at the VRAM cell where this row's tile is drawn.
 * The dispatcher only reaches state 0 when the rank is nonzero, so in practice the pass count is at
 * least 1; the do-while form would run 256 passes on a count of 0, which never occurs here.
 *
 * WHICH CONTROLS. The name-entry that follows reads one player's joystick, chosen into loc_8e21
 * (0x8e21): player 1's input sample (INPUT_PORT1, 0x8811) by default, switching to player 2's
 * (INPUT_PORT2, 0x8812) only on an upright cabinet with player 2 active — a cocktail cabinet flips
 * the screen for player 2 instead, so it keeps reading port 1.
 *
 * FIXED SEED FIELDS. It also primes the animation's constants: the row/pass count (0x8e25 = 3), a
 * 16-bit countdown (0x8e2b = 0x03a0), the tile index the stepper animates (0x8e23 = 0x11), and the
 * per-step delay reload (0x8e24 = 0x0c). The landing VRAM cell is stamped with tile 0x11 so the row
 * shows its first tile immediately.
 *
 * LIVE-OUT: none — a void handler; only the memory writes survive.
 */

const RECORD_STRIDE = 0x03; // +3 per pass
const WRITE_PTR_STEP = 0x02; //  +2 per pass
const STAMP_BYTE = 0x11; //      written at the landing address

export function seedWriteAnimWorkBlock(m) {
  const { mem8, mem16 } = m;

  // Both walks below step this many times: the new entry's rank (HIGH_SCORE_INSERT_RANK, 0x89fc),
  // stored as winning-rank-plus-one. The dispatcher only enters here when it is nonzero.
  const count = mem8[HIGH_SCORE_INSERT_RANK]; // pass count for both walks

  // Seed the stamp base into WRITE_ANIM_WRITE_PTR (0x8e27). The tilemap cell DISPLAY_LIST_VRAM_TILE
  // (0x8565) is the top row's tile; the stamp walk below reads this back and advances from it.
  mem16[WRITE_ANIM_WRITE_PTR] = DISPLAY_LIST_VRAM_TILE; // stash the stamp base (read back for the second walk)

  // Fixed seeds for the stepper: WRITE_ANIM_ROW_COUNT (0x8e25) is the 3-row/pass budget it drains,
  // and WRITEANIM_COUNTDOWN (0x8e2b) is a 16-bit timer preloaded to 0x03a0 (the fire-phase seed).
  mem8[WRITE_ANIM_ROW_COUNT] = 0x03;
  mem16[WRITEANIM_COUNTDOWN] = FIRE_PHASE_SEED;

  // Record walk: from the base-minus-one anchor (0x8dfd), step +3 per rank to reach this entry's
  // three-byte record, and store it as the work block's record pointer ANIM_WORK_BLOCK_PTR (0x8e1f).
  // (A count of 0 would run 256 passes; the dispatcher precludes that.)
  let recordPtr = WRITE_ANIM_RECORD_ANCHOR;
  let b = count;
  do {
    recordPtr = u16(recordPtr + RECORD_STRIDE);
    b = u8(b - 1);
  } while (b !== 0);
  mem16[ANIM_WORK_BLOCK_PTR] = recordPtr;

  // Choose which player's controls the name-entry reads. Default to player 1 (INPUT_PORT1, 0x8811);
  // pick player 2 (INPUT_PORT2, 0x8812) only on an upright cabinet (CABINET_MODE_FLAG 0x880f == 0)
  // with player 2 up (ACTIVE_PLAYER 0x880d != 0) — a cocktail cabinet rotates for P2 and keeps P1's
  // port. The choice is parked in loc_8e21 (0x8e21) for the later handlers to poll.
  let srcPtr = INPUT_PORT1;
  if (mem8[CABINET_MODE_FLAG] === 0 && mem8[ACTIVE_PLAYER] !== 0) srcPtr = INPUT_PORT2;
  mem16[loc_8e21] = srcPtr;

  // Stamp-pointer walk: read the stamp base back and step +2 per rank into VRAM, landing on the
  // tilemap cell for this row, then store the advanced pointer back to WRITE_ANIM_WRITE_PTR (0x8e27).
  let writePtr = mem16[WRITE_ANIM_WRITE_PTR]; // the stamp base
  let b2 = count;
  do {
    writePtr = u16(writePtr + WRITE_PTR_STEP);
    b2 = u8(b2 - 1);
  } while (b2 !== 0);
  mem16[WRITE_ANIM_WRITE_PTR] = writePtr; // advanced pointer

  // Draw the row's first tile now, and prime the stepper's remaining fields: the animated tile index
  // WRITE_ANIM_TILE_INDEX (0x8e23) starts at 0x11, the state selector WRITE_ANIM_HANDLER_SELECT
  // (0x8e26) advances to handler 1 (the stepper), and WRITE_ANIM_STEP_DELAY (0x8e24) reloads to 0x0c
  // frames between steps.
  mem8[writePtr] = STAMP_BYTE; // stamp at the landing address
  mem8[WRITE_ANIM_TILE_INDEX] = STAMP_BYTE;
  mem8[WRITE_ANIM_HANDLER_SELECT] = 0x01;
  mem8[WRITE_ANIM_STEP_DELAY] = 0x0c;
}
