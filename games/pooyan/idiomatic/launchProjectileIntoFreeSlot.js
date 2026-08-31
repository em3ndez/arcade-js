// SPDX-License-Identifier: GPL-3.0-only
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import {
  SPAWN_COUNTER,
  PROJECTILE_TABLE,
  ROUND_COUNTER,
  PLAY_MODE_LATCH,
  SPAWN_ATTR_INDEX,
  SPAWN_COORD_TABLE_3B57,
  SPAWN_COORD_TABLE_3B47,
  SPAWN_ANIM_TABLE_396A,
  SPAWN_ANIM_TABLE_3979,
  SPAWN_ANIM_TABLE_39A0,
  HIT_FLASH_ANIM_3BDD,
  HIT_FLASH_ANIM_433B,
  HIT_FLASH_ANIM_4341,
  SPAWN_ATTR_TABLE_3B37,
  SPAWN_ATTR_TABLE_3B3F,
} from "./names.js";
/**
 * launchProjectileIntoFreeSlot — launch a projectile into the first free slot of the 3-slot object table.
 *
 * Bumps the spawn counter, then scans the table (stride 0x18) for a slot whose active bit is
 * clear. With no free slot it returns after the bump. Otherwise it seeds the found slot from the
 * launcher record at IX: a heading index picks a coordinate pair from the round-selected table,
 * an animation is armed on the launcher, a hit-flash sequence and a rotating display attribute
 * are stored, and the launcher's step field is nudged down.
 *
 * LIVE-OUT: none — the callers read no register back; every effect is in memory.
 */

const SLOTS = 3;
const STRIDE = 0x18;

export function launchProjectileIntoFreeSlot(m, rec = m.regs.ix) {
  const { mem8 } = m;

  mem8[SPAWN_COUNTER] = mem8[SPAWN_COUNTER] + 1;

  // first slot whose active bit (bit0 of the first two bytes OR'd) is clear
  let slot = null;
  for (let i = 0; i < SLOTS; i++) {
    const s = PROJECTILE_TABLE + i * STRIDE;
    if (((mem8[s] | mem8[s + 1]) & 1) === 0) { slot = s; break; }
  }
  if (slot === null) return; // no free slot

  // coordinate pair: heading index into the round-selected word table
  const headingIndex = (((mem8[rec + 0x06] - 0x06) & 0xff) >> 1) & 0x07;
  const coordTable = mem8[ROUND_COUNTER] & 0x01 ? SPAWN_COORD_TABLE_3B47 : SPAWN_COORD_TABLE_3B57;
  const coordPtr = fetchWordFromTableIndex(m, headingIndex, coordTable);
  mem8[slot + 0x12] = mem8[coordPtr];
  mem8[slot + 0x13] = mem8[coordPtr + 1];
  mem8[slot + 0x08] = mem8[slot + 0x08] | 0x01; // mark seeded

  // arm the launcher's animation, chosen by its facing/mode bits
  let animPtr = SPAWN_ANIM_TABLE_396A;
  if (mem8[rec + 0x07] & 0x02) animPtr = SPAWN_ANIM_TABLE_3979;
  if ((mem8[rec + 0x16] & 0x30) === 0x30) animPtr = SPAWN_ANIM_TABLE_39A0;
  setActorAnimation(m, rec, animPtr);

  mem8[rec + 0x08] = mem8[rec + 0x08] - 0x10; // nudge launcher step

  mem8[slot + 0x00] = 0x01; // active
  mem8[slot + 0x02] = 0x0b;
  mem8[slot + 0x07] = 0x01;

  // hit-flash sequence: default, or one of two play-mode variants
  let flashPtr = HIT_FLASH_ANIM_3BDD;
  if (mem8[PLAY_MODE_LATCH] !== 0) {
    flashPtr = HIT_FLASH_ANIM_433B;
    if (mem8[ROUND_COUNTER] & 0x04) flashPtr = HIT_FLASH_ANIM_4341;
  }
  mem8[slot + 0x0c] = flashPtr; // low byte
  mem8[slot + 0x0d] = flashPtr >> 8; // high byte

  mem8[slot + 0x0e] = 0x00;
  mem8[slot + 0x16] = 0x00;
  mem8[slot + 0x11] = 0x13;
  mem8[slot + 0x14] = rec; // launcher pointer, low byte
  mem8[slot + 0x15] = rec >> 8; // launcher pointer, high byte

  // rotating display attribute stored back on the launcher
  mem8[SPAWN_ATTR_INDEX] = mem8[SPAWN_ATTR_INDEX] + 1;
  const attrIndex = mem8[SPAWN_ATTR_INDEX] & 0x07;
  const attrTable = mem8[ROUND_COUNTER] & 0x01 ? SPAWN_ATTR_TABLE_3B3F : SPAWN_ATTR_TABLE_3B37;
  const [attr] = fetchByteFromTableIndex(m, attrTable, attrIndex);
  mem8[rec + 0x15] = attr;
}
