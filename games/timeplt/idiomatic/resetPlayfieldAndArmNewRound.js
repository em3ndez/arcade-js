// SPDX-License-Identifier: GPL-3.0-only
/** resetPlayfieldAndArmNewRound — reset the whole playfield for a fresh round: clear the scroll and control cells, seat
 * the ship sprite and shot slots, retire every object slot in its own way, clear four sprite
 * entries, seat the era's scenery band, then scatter one era-selected ten-byte record from a word
 * table into the cells that arm the round. LIVE-OUT: memory-only. */

import { dressPlayerSpriteForHeading } from "./dressPlayerSpriteForHeading.js";
import { freeAllShotSlots } from "./freeAllShotSlots.js";
import { retireObjectAndHold } from "./retireObjectAndHold.js";
import { retireSlotIntoSharedCooldown } from "./retireSlotIntoSharedCooldown.js";
import { retireSlotIntoCooldown } from "./retireSlotIntoCooldown.js";
import { retireSlotAndSubPixel } from "./retireSlotAndSubPixel.js";
import { freeAndNumberEveryObjectSlot } from "./freeAndNumberEveryObjectSlot.js";
import { loc_30a5 } from "./loc_30a5.js";
import { fetchTableWord } from "./fetchTableWord.js";
import { u8 } from "../../../core/int.js";
import { ROUND_CRAFT_COUNT, ROUND_TRANSITION_HOLD, SCRIPT_PICK_THRESHOLD, SHOT_BURST_PENDING } from "./names.js";

const SUBPIXEL_SLOTS = 7;
const RECORD_STRIDE = 16;
const ENTRY_STRIDE = 2;
const SUBPIXEL_FIRST_RECORD = 0xa8f0;
const SUBPIXEL_FIRST_ENTRY = 0xaa2e;

const CLEARED_ENTRY_BASE = 0xaa28;
const CLEARED_ENTRY_OFFSETS = [0, 2, 4, 6, 0x31, 0x33, 0x35, 0x37];

const RECORD_TABLE = 0x1b04;
const ERA_INDEX = 0xad04;

export function resetPlayfieldAndArmNewRound(m) {
  const { regs, mem8, mem16 } = m;

  mem16[0xa808] = 0;
  mem16[0xa80a] = 0;
  mem16[0xad06] = 0;
  mem8[0xad0d] = 0;
  mem8[0xa8f7] = 0;
  mem8[0xad05] = 0;
  mem8[0xa9d7] = mem8[0xa9d6];
  mem8[0xacc0] = mem8[0xad0a];
  mem8[SHOT_BURST_PENDING] = 0;
  mem8[ROUND_TRANSITION_HOLD] = 0;
  mem8[0xa802] = 0x80;
  mem8[0xa801] = 0;
  mem8[0xa800] = 0xff;
  mem8[0xaa41] = 0x78;
  mem8[0xaa10] = 0x84;

  dressPlayerSpriteForHeading(m);
  freeAllShotSlots(m);
  retireObjectAndHold(m, 0xa8c0, 0xaa28);

  regs.ix = 0xa8e0;
  regs.iy = 0xaa2c;
  retireSlotIntoSharedCooldown(m);

  retireSlotIntoCooldown(m, SUBPIXEL_FIRST_RECORD, SUBPIXEL_FIRST_ENTRY);

  let record = SUBPIXEL_FIRST_RECORD;
  let entry = SUBPIXEL_FIRST_ENTRY;
  for (let i = 0; i < SUBPIXEL_SLOTS; i++) {
    retireSlotAndSubPixel(m, record, entry);
    record += RECORD_STRIDE;
    entry += ENTRY_STRIDE;
  }

  freeAndNumberEveryObjectSlot(m);
  for (const off of CLEARED_ENTRY_OFFSETS) mem8[CLEARED_ENTRY_BASE + off] = 0;

  loc_30a5(m);

  const band = (mem8[ERA_INDEX] & 0x0f) << 4; // era in the high nibble, index into the word table
  regs.a = u8(mem8[0xacc0] + band);
  regs.hl = RECORD_TABLE;
  const src = fetchTableWord(m);

  mem8[0xa844] = mem8[src];
  mem8[0xa837] = mem8[src + 1];
  mem8[0xa827] = mem8[src + 2];
  mem8[0xa814] = mem8[0xa817] = mem8[src + 3]; // one source byte into two cells
  mem8[ROUND_CRAFT_COUNT] = mem8[src + 4];
  mem8[SCRIPT_PICK_THRESHOLD] = mem8[src + 5];
  mem8[0xa8c6] = mem8[src + 6];
  mem8[0xa8d6] = mem8[src + 7];
  mem8[0xa8e6] = mem8[src + 8];
  mem8[0xa8f4] = mem8[0xa8f6] = mem8[src + 9]; // one source byte into two cells
}
