// SPDX-License-Identifier: GPL-3.0-only
// Sub-state reset: paint a short strip at the VRAM cursor and advance it, then tick the dwell tier. On the
// tier's expiry bump the sequence step, re-arm the dwell cascade, clear the active-object block and the two
// screen-flip latches, raise a status flag, and reseed the object-shadow field from a template.
import { u16 } from "../../../core/int.js";
import {
  VRAM_WRITE_PTR, loc_4009, SEQUENCE_STATE, loc_4008, OBJ_ACTIVE_FLAG,
  FLIP_SCREEN_X, FLIP_SCREEN_Y, loc_4018, loc_4238, OBJ_SHADOW_RESEED_TEMPLATE,
} from "./names.js";
import { fillMemoryBlock } from "./fillMemoryBlock.js";
import { seedObjectRamShadowField } from "./seedObjectRamShadowField.js";

const STRIP_FILL_TILE = 16; // tile painted across the strip

export function fillVramRowThenResetObjectState(m) {
  const { mem8, mem16 } = m;

  // Paint a 28-cell strip at the cursor, then step the cursor a full 32-cell row on.
  const fillPtr = mem16[VRAM_WRITE_PTR];
  fillMemoryBlock(m, fillPtr, STRIP_FILL_TILE, 28);
  mem16[VRAM_WRITE_PTR] = u16(fillPtr + 32);

  // Tick the dwell tier; keep waiting while it is still counting down.
  mem8[loc_4009] = mem8[loc_4009] - 1;
  if (mem8[loc_4009] !== 0) return;

  // Expired: advance the sequence step and re-arm the two-tier dwell cascade.
  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1;
  mem8[loc_4008] = 64;
  mem8[loc_4009] = 4;

  // Clear the active-object block, the screen-flip latches and the direction flag; raise the status flag.
  fillMemoryBlock(m, OBJ_ACTIVE_FLAG, 0, 48);
  mem8[FLIP_SCREEN_X] = 0;
  mem8[FLIP_SCREEN_Y] = 0;
  mem8[loc_4018] = 0;
  mem8[loc_4238] = 1;

  return seedObjectRamShadowField(m, OBJ_SHADOW_RESEED_TEMPLATE);
}
