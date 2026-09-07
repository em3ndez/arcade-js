// SPDX-License-Identifier: GPL-3.0-only
// fillVramRowThenResetObjectState — attract sub-state 3: clear the screen a row at a time, then reset
// the object state when the dwell expires.
//
// WHAT IT IS
//   A per-frame handler that paints a 28-cell strip of the blank tile at the VRAM write cursor and steps
//   the cursor on by a full 32-cell row, so it wipes the playfield one row per frame. Alongside it ticks
//   a dwell timer; when the dwell finally expires it advances the sequence step, re-arms the dwell
//   cascade, wipes the active-object block and screen-flip latches, and reseeds the object-shadow field.
//
// ROLE IN THE MACHINE
//   This is sub-state 3 of the attract-mode sequence machine runAttractSequenceAndAdvanceOnCredit
//   (rst-28 dispatch table @0x0164; see mechanisms.md "The attract / sequence state machine"). The strip
//   fill progressively clears the tilemap (0x5000-0x53ff) row by row; the dwell tier loc_4009 holds this
//   step for a fixed number of frames. On expiry it hands off to the next step and re-primes both tiers
//   of the dwell cascade (loc_4008 the fast sub-timer, loc_4009 the dwell), then puts the object layer
//   into a clean pre-figure state before the next screen is built.
//
// ROM 0x01e1.  Grounding: [seen].
//
// LIVE-OUT: VRAM_WRITE_PTR advanced one row; on dwell expiry SEQUENCE_STATE bumped, dwell cascade
// re-armed, object/flip state cleared, and the object-shadow field reseeded (delegated return value).
import { u16 } from "../../../core/int.js";
import {
  VRAM_WRITE_PTR, loc_4009, SEQUENCE_STATE, loc_4008, OBJ_ACTIVE_FLAG,
  FLIP_SCREEN_X, FLIP_SCREEN_Y, loc_4018, OBJECT_DRAW_SUPPRESS, OBJ_SHADOW_RESEED_TEMPLATE,
} from "./names.js";
import { fillMemoryBlock } from "./fillMemoryBlock.js";
import { seedObjectRamShadowField } from "./seedObjectRamShadowField.js";

const STRIP_FILL_TILE = 16; // tile painted across the strip

export function fillVramRowThenResetObjectState(m) {
  const { mem8, mem16 } = m;

  // Paint a 28-cell strip of the blank tile at the cursor (VRAM_WRITE_PTR, 0x400b), then step the cursor
  // a full 32-cell row on. Filling 28 but advancing 32 clears the visible width and skips the row margin.
  const fillPtr = mem16[VRAM_WRITE_PTR];
  fillMemoryBlock(m, fillPtr, STRIP_FILL_TILE, 28);
  mem16[VRAM_WRITE_PTR] = u16(fillPtr + 32);

  // Tick the dwell tier (loc_4009); while it is still counting down this step just keeps clearing rows.
  mem8[loc_4009] = mem8[loc_4009] - 1;
  if (mem8[loc_4009] !== 0) return;

  // Dwell expired: advance to the next sequence step and re-arm the two-tier dwell cascade
  // (loc_4008 = 64 fast sub-timer, loc_4009 = 4 dwell) for the step that follows.
  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1;
  mem8[loc_4008] = 64;
  mem8[loc_4009] = 4;

  // Reset the object layer for the next screen: clear the 48-byte active-object/flag block, drop both
  // screen-flip latches (FLIP_SCREEN_X 0x7006 / FLIP_SCREEN_Y 0x7007) and the loc_4018 direction cell,
  // and set OBJECT_DRAW_SUPPRESS (0x4238) bit0 to hold the object-figure grid draw off during the reset.
  fillMemoryBlock(m, OBJ_ACTIVE_FLAG, 0, 48);
  mem8[FLIP_SCREEN_X] = 0;
  mem8[FLIP_SCREEN_Y] = 0;
  mem8[loc_4018] = 0;
  mem8[OBJECT_DRAW_SUPPRESS] = 1;

  // Reseed the stride-2 OBJRAM shadow field from the ROM template at 0x1db1, priming the object shadow.
  return seedObjectRamShadowField(m, OBJ_SHADOW_RESEED_TEMPLATE);
}
