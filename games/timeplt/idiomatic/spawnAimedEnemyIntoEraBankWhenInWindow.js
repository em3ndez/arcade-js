// SPDX-License-Identifier: GPL-3.0-only
/** spawnAimedEnemyIntoEraBankWhenInWindow — spawn one aimed enemy, but only when the spawn slot is free, the cooldown at
 * ATTACKER_SPAWN_COOLDOWN is clear, the era count is live, and some object in the caller's two-slot bank sits
 * inside a doubled window. Draws a heading toward the player at ENEMY_STANDOFF_AIM_MAIN, alternates the aim's
 * side each spawn via ATTACKER_SPAWN_AIM_SIDE_TOGGLE, then seats coords, the doubled velocity pair, a script and a
 * shape into the era's fixed record+sprite bank and reloads the cooldown. LIVE-OUT: memory. The routine is a
 * pure writer — its sole caller (advanceTwoTileObjectThenTryAimedSpawn) tail-returns and reads no register it
 * leaves, and that whole dispatch chain up to serviceEra1BomberObject is memory-only — so the search pointers,
 * the window bound and the loop count all live here as JS locals. The aimed heading passes into the velocity
 * shim as an argument, and the shim hands the doubled pair back, which this routine reads straight into the record. */

import { u8, u16 } from "../../../core/int.js";
import { requestEnemyLaunchSound } from "./requestEnemyLaunchSound.js";
import { headingToward } from "./headingToward.js";
import { loc_59c5 } from "./loc_59c5.js";
import { ACTOR_ENTRY_SLOT3, ACTOR_RECORD_SLOT3, ATTACKER_SPAWN_AIM_SIDE_TOGGLE, ATTACKER_SPAWN_COOLDOWN, ATTACKER_SPAWN_COOLDOWN_PERIOD, ATTACKER_SPAWN_SLOT_COUNT, ATTACKER_SPAWN_WINDOW_HALF, ENEMY_STANDOFF_AIM_MAIN, ERA_OBJECT_ENTRY_SLOT2, ERA_OBJECT_RECORD_SLOT2 } from "./names.js";


const SLOT_FREE = 0xff;
const SEARCH_SLOTS = 2;
const RECORD_STRIDE = 0x10;
const ENTRY_STRIDE = 2;
const ENTRY_X = 0x00;
const ENTRY_Y = 0x31;
const X_ORIGIN = 0x84;
const Y_ORIGIN = 0x78;
const TURN = 0x18;

const NEW_SCRIPT = 0x4d;
const NEW_SHAPE = 0x62;

// era count != 1 with the scan flag clear selects the second bank; the guard and the seat both ask.
const useSecondBank = (m) => m.mem8[ATTACKER_SPAWN_SLOT_COUNT] !== 1 && m.mem8[ERA_OBJECT_RECORD_SLOT2] === 0;

export function spawnAimedEnemyIntoEraBankWhenInWindow(m, ix = m.regs.ix, iy = m.regs.iy) {
  const { mem8 } = m;

  if (mem8[ix] !== SLOT_FREE) return;
  if (mem8[ATTACKER_SPAWN_COOLDOWN] !== 0) return;
  if (mem8[ATTACKER_SPAWN_SLOT_COUNT] === 0) return;
  if (!useSecondBank(m) && mem8[ACTOR_RECORD_SLOT3] !== 0) return;

  // scan the caller's two-slot bank for an object inside the doubled window; the record pointer walks
  // in lockstep with the entry pointer but its landing slot is discarded — the seat below is fixed.
  const half = mem8[ATTACKER_SPAWN_WINDOW_HALF];
  const full = u8(2 * half);
  let count = SEARCH_SLOTS;
  let hit = false;
  do {
    const x = u8(u8(X_ORIGIN - mem8[u16(iy + ENTRY_X)]) + half);
    const y = u8(u8(Y_ORIGIN - mem8[u16(iy + ENTRY_Y)]) + half);
    if (x >= full || y >= full) { hit = true; break; }
    ix = u16(ix + RECORD_STRIDE);
    iy = u16(iy + ENTRY_STRIDE);
    count = u8(count - 1);
  } while (count !== 0);
  if (!hit) return;

  requestEnemyLaunchSound(m);
  const heading = headingToward(m, ENEMY_STANDOFF_AIM_MAIN, iy);
  mem8[ATTACKER_SPAWN_AIM_SIDE_TOGGLE] = u8(mem8[ATTACKER_SPAWN_AIM_SIDE_TOGGLE] + 1);
  const turn = mem8[ATTACKER_SPAWN_AIM_SIDE_TOGGLE] & 1 ? TURN : u8(-TURN);
  const aimed = u8(turn + heading);

  const foundY = mem8[u16(iy + ENTRY_Y)];
  const foundX = mem8[u16(iy + ENTRY_X)];
  let recBank, entBank;
  if (useSecondBank(m)) {
    recBank = ERA_OBJECT_RECORD_SLOT2;
    entBank = ERA_OBJECT_ENTRY_SLOT2;
  } else {
    recBank = ACTOR_RECORD_SLOT3;
    entBank = ACTOR_ENTRY_SLOT3;
  }

  mem8[entBank + ENTRY_Y] = foundY;
  mem8[entBank + ENTRY_X] = foundX;
  const [de, bc] = loc_59c5(m, aimed); // doubled velocity pair for the aimed heading
  mem8[recBank + 0x0a] = de;
  mem8[recBank + 0x0b] = u8(de >> 8);
  mem8[recBank + 0x0c] = bc;
  mem8[recBank + 0x0d] = u8(bc >> 8);
  mem8[entBank + 0x01] = NEW_SCRIPT;
  mem8[entBank + 0x30] = NEW_SHAPE;
  mem8[recBank] = u8(mem8[recBank] - 1);
  mem8[ATTACKER_SPAWN_COOLDOWN] = mem8[ATTACKER_SPAWN_COOLDOWN_PERIOD];
}
