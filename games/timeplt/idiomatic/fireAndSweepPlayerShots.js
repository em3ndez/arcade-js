// SPDX-License-Identifier: GPL-3.0-only
/** fireAndSweepPlayerShots — on a fire-button rising edge arm and seed one shot into a free slot of the
 * six-slot player-shot bank, aimed along the ship heading; then move every live shot by the world scroll,
 * dropping any that leaves the field or whose head byte is stale. LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { readPlayerControls } from "./readPlayerControls.js";
import { loc_567e } from "./loc_567e.js";
import { fetchWideTableWord } from "./fetchWideTableWord.js";
import { queueTileStampForObject } from "./queueTileStampForObject.js";
import { PLAYER_HEADING, PLAYER_STATE, PLAY_ACTIVE, ROUND_TRANSITION_HOLD, WORLD_SCROLL_X, WORLD_SCROLL_Y } from "./names.js";

const PHASE_SHIFT_REG = 0xa98e;
const SPAWNS_ARMED = 0xaa81;
const SPAWN_COOLDOWN = 0xaa82;
const SLOT_BANK = 0xaa80;
const SLOT_COUNT = 6;
const RECORD_STRIDE = 16;
const SEARCH_STRIDE_SRC = 0x0d46;
const VELOCITY_TABLE = 0x2771;

const OCC = 0;
const AXIS1 = 3;
const AXIS2 = 5;
const SEED1 = 10;
const SEED2 = 12;

export function fireAndSweepPlayerShots(m) {
  const { mem8, mem16 } = m;
  if (mem8[PLAYER_STATE] !== 0xff) return sweepSlots(m);
  if (mem8[ROUND_TRANSITION_HOLD] !== 0) return sweepSlots(m);

  const controls = readPlayerControls(m);
  mem8[PHASE_SHIFT_REG] = u8((mem8[PHASE_SHIFT_REG] << 1) | ((controls >> 4) & 1));
  if ((mem8[PHASE_SHIFT_REG] & 0x03) === 1) mem8[SPAWNS_ARMED] = 3;

  if (mem8[PLAY_ACTIVE] !== 0 && mem8[SPAWNS_ARMED] === 0) return sweepSlots(m);
  if (mem8[SPAWN_COOLDOWN] !== 0) return sweepSlots(m);

  let slot = SLOT_BANK;
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (mem8[slot] === 0) { spawnIntoFreeSlot(m, slot); break; }
    slot = u16(slot + mem16[SEARCH_STRIDE_SRC]);
  }
  return sweepSlots(m);
}

function spawnIntoFreeSlot(m, slot) {
  const { regs, mem8, mem16 } = m;
  loc_567e(m);

  mem16[slot + SEED1] = u16(-4 * mem16[WORLD_SCROLL_Y]);
  mem16[slot + SEED2] = u16(-4 * mem16[WORLD_SCROLL_X]);

  regs.hl = VELOCITY_TABLE;
  regs.a = (u8(mem8[PLAYER_HEADING] + 4) >> 3) & 0x1f;
  fetchWideTableWord(m);
  const velocity = regs.de;

  mem8[slot + OCC] = u8(mem8[slot + OCC] - 1);
  mem8[slot + AXIS1] = 0;
  mem8[slot + AXIS1 + 1] = velocity & 0xff;
  mem8[slot + AXIS2] = 0;
  mem8[slot + AXIS2 + 1] = velocity >> 8;

  mem8[SPAWNS_ARMED] = u8(mem8[SPAWNS_ARMED] - 1);
  mem8[SPAWN_COOLDOWN] = 6;
}

function sweepSlots(m) {
  const { mem8, mem16 } = m;
  if (mem8[SPAWN_COOLDOWN] !== 0) mem8[SPAWN_COOLDOWN] = u8(mem8[SPAWN_COOLDOWN] - 1);

  for (let i = 0; i < SLOT_COUNT; i++) {
    const slot = SLOT_BANK + i * RECORD_STRIDE;
    const head = mem8[slot + OCC];
    if (head === 0) continue;
    if (u8(head + 1) !== 0) { cullSlot(m, slot); continue; }

    const x = u16(u16(mem16[slot + SEED1] + mem16[WORLD_SCROLL_Y]) + mem16[slot + AXIS1]);
    if (u8((x >> 8) + 0x10) < 0x10) { cullSlot(m, slot); continue; }
    mem16[slot + AXIS1] = x;

    const y = u16(u16(mem16[slot + SEED2] + mem16[WORLD_SCROLL_X]) + mem16[slot + AXIS2]);
    if (u8((y >> 8) + 0x08) < 0x18) { cullSlot(m, slot); continue; }
    mem16[slot + AXIS2] = y;

    queueTileStampForObject(m, slot);
  }
}

function cullSlot(m, slot) {
  const { mem8 } = m;
  mem8[slot + OCC] = 0;
  mem8[slot + AXIS1 + 1] = 0;
  mem8[slot + AXIS2 + 1] = 0;
}
