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
import { seatEraSceneryRowThenClearAndRunScenery } from "./seatEraSceneryRowThenClearAndRunScenery.js";
import { fetchTableWord } from "./fetchTableWord.js";
import { u8 } from "../../../core/int.js";
import { ATTACKER_SPAWN_AIM_WINDOW_HALF, ATTACKER_SPAWN_COOLDOWN, ATTACKER_SPAWN_COOLDOWN_PERIOD, ATTACKER_SPAWN_SLOT_COUNT, ATTACKER_SPAWN_WINDOW_HALF, BANK_LAUNCH_COOLDOWN, BANK_LAUNCH_COOLDOWN_PERIOD, BANK_LAUNCH_NEAR_HALF_X, BANK_LAUNCH_NEAR_HALF_Y, BANK_LAUNCH_SLOT_COUNT, ERA_OBJECT_ENTRY_SLOT0, ERA_OBJECT_ENTRY_SLOT2, ERA_OBJECT_RECORD_SLOT0, ERA_OBJECT_RECORD_SLOT2, PARACHUTIST_ENTRY, PARACHUTIST_RECORD, PLAYER_ENTRY, PLAYER_SPRITE_Y, ROUND_CRAFT_COUNT, ROUND_TRANSITION_HOLD, SCRIPT_PICK_THRESHOLD, SHOT_BURST_PENDING } from "./names.js";

const SUBPIXEL_SLOTS = 7;
const RECORD_STRIDE = 16;
const ENTRY_STRIDE = 2;

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
  mem8[PLAYER_SPRITE_Y] = 0x78;
  mem8[PLAYER_ENTRY] = 0x84;

  dressPlayerSpriteForHeading(m);
  freeAllShotSlots(m);
  retireObjectAndHold(m, ERA_OBJECT_RECORD_SLOT0, ERA_OBJECT_ENTRY_SLOT0);

  regs.ix = ERA_OBJECT_RECORD_SLOT2;
  regs.iy = ERA_OBJECT_ENTRY_SLOT2;
  retireSlotIntoSharedCooldown(m);

  retireSlotIntoCooldown(m, PARACHUTIST_RECORD, PARACHUTIST_ENTRY);

  let record = PARACHUTIST_RECORD;
  let entry = PARACHUTIST_ENTRY;
  for (let i = 0; i < SUBPIXEL_SLOTS; i++) {
    retireSlotAndSubPixel(m, record, entry);
    record += RECORD_STRIDE;
    entry += ENTRY_STRIDE;
  }

  freeAndNumberEveryObjectSlot(m);
  for (const off of CLEARED_ENTRY_OFFSETS) mem8[ERA_OBJECT_ENTRY_SLOT0 + off] = 0;

  seatEraSceneryRowThenClearAndRunScenery(m);

  const band = (mem8[ERA_INDEX] & 0x0f) << 4; // era in the high nibble, index into the word table
  regs.a = u8(mem8[0xacc0] + band);
  regs.hl = RECORD_TABLE;
  const src = fetchTableWord(m);

  mem8[BANK_LAUNCH_SLOT_COUNT] = mem8[src];
  mem8[BANK_LAUNCH_NEAR_HALF_X] = mem8[src + 1];
  mem8[BANK_LAUNCH_NEAR_HALF_Y] = mem8[src + 2];
  mem8[BANK_LAUNCH_COOLDOWN_PERIOD] = mem8[BANK_LAUNCH_COOLDOWN] = mem8[src + 3]; // one source byte into two cells
  mem8[ROUND_CRAFT_COUNT] = mem8[src + 4];
  mem8[SCRIPT_PICK_THRESHOLD] = mem8[src + 5];
  mem8[ATTACKER_SPAWN_SLOT_COUNT] = mem8[src + 6];
  mem8[ATTACKER_SPAWN_WINDOW_HALF] = mem8[src + 7];
  mem8[ATTACKER_SPAWN_AIM_WINDOW_HALF] = mem8[src + 8];
  mem8[ATTACKER_SPAWN_COOLDOWN] = mem8[ATTACKER_SPAWN_COOLDOWN_PERIOD] = mem8[src + 9]; // one source byte into two cells
}
