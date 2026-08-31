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
 * WHAT IT IS
 *   ROM 0x3a6c-0x3b29. Grounding: [seen]. This is how an enemy hurls a projectile at the
 *   player. Enemy AI calls it when a launcher (an enemy actor, its record addressed by `rec`)
 *   decides to fire; the routine finds a home for the new projectile in the shared object pool
 *   and fills that record in from the launcher's current facing/heading.
 *
 * ROLE IN THE MACHINE
 *   Projectiles live in PROJECTILE_TABLE (0x8be8), a 3-slot pool of fixed-stride (0x18) actor
 *   records. Each record carries the same field layout as every other actor in the arena: a
 *   two-byte presence header, a state index, an animation-stream pointer, timers, and a
 *   collision/back-pointer field. A projectile is nothing more than one of these records marked
 *   live and pointed at the right animation and heading; from then on the per-frame actor sweep
 *   carries it across the screen and the collision scan matches it against the player.
 *
 * WHAT IT LEAVES BEHIND
 *   - SPAWN_COUNTER (0x8d42) is bumped on entry, before the slot scan, so it counts every launch
 *     attempt whether or not a slot is free.
 *   - On success, one PROJECTILE_TABLE record is fully seeded and marked active; the launcher's
 *     own animation is (re)armed, its step field nudged, and its rotating display attribute
 *     advanced one notch.
 *   - With every projectile slot already occupied the routine does nothing further after the
 *     counter bump — the launch is silently dropped this frame.
 *
 * LIVE-OUT: none — the callers read no register back; every effect is in memory.
 */

const SLOTS = 3;
const STRIDE = 0x18;

export function launchProjectileIntoFreeSlot(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Bump the running spawn counter (0x8d42) on entry. This happens before the free-slot search,
  // so it ticks on every attempt to launch — a monotonic count of launch events, not of
  // successful projectiles. Its low bits are read elsewhere as a rotating table index.
  mem8[SPAWN_COUNTER] = mem8[SPAWN_COUNTER] + 1;

  // Find a home for the projectile: walk the 3 records of PROJECTILE_TABLE (0x8be8) at the
  // 0x18 record stride and take the first vacant one. A record's two-byte presence header
  // (bytes +0x00/+0x01) doubles as its liveness flag; OR the two bytes and test bit 0 — a clear
  // bit 0 means the slot is dormant and free to reuse.
  // first slot whose active bit (bit0 of the first two bytes OR'd) is clear
  let slot = null;
  for (let i = 0; i < SLOTS; i++) {
    const s = PROJECTILE_TABLE + i * STRIDE;
    if (((mem8[s] | mem8[s + 1]) & 1) === 0) { slot = s; break; }
  }
  // Every slot busy: abandon the launch for this frame (the counter above already ticked).
  if (slot === null) return; // no free slot

  // Choose the projectile's heading. The launcher's field +0x06 holds its aim/heading source;
  // fold it to a 0..7 index — subtract the 0x06 bias, halve it (headings are spaced two apart),
  // and mask to three bits. The word table it indexes is round-dependent: ROUND_COUNTER (0x8907)
  // bit 0 selects the alternate coordinate table 0x3b47, otherwise 0x3b57. The looked-up word is
  // a pointer to a 2-byte coordinate/heading record in ROM; copy that pair into the projectile's
  // +0x12/+0x13 fields, then set bit 0 of +0x08 to mark the record seeded.
  // coordinate pair: heading index into the round-selected word table
  const headingIndex = (((mem8[rec + 0x06] - 0x06) & 0xff) >> 1) & 0x07;
  const coordTable = mem8[ROUND_COUNTER] & 0x01 ? SPAWN_COORD_TABLE_3B47 : SPAWN_COORD_TABLE_3B57;
  const coordPtr = fetchWordFromTableIndex(m, headingIndex, coordTable);
  mem8[slot + 0x12] = mem8[coordPtr];
  mem8[slot + 0x13] = mem8[coordPtr + 1];
  mem8[slot + 0x08] = mem8[slot + 0x08] | 0x01; // mark seeded

  // Arm the launcher's own throwing animation (this animates the enemy that is firing, not the
  // projectile). Pick the animation sequence from the launcher's facing/mode bits: default
  // 0x396a; if facing flag (rec+0x07) bit 1 is set use 0x3979; and if the mode bits
  // (rec+0x16) & 0x30 are both set (== 0x30) use 0x39a0. setActorAnimation points the launcher's
  // record at the chosen sequence and restarts it from its first frame.
  // arm the launcher's animation, chosen by its facing/mode bits
  let animPtr = SPAWN_ANIM_TABLE_396A;
  if (mem8[rec + 0x07] & 0x02) animPtr = SPAWN_ANIM_TABLE_3979;
  if ((mem8[rec + 0x16] & 0x30) === 0x30) animPtr = SPAWN_ANIM_TABLE_39A0;
  setActorAnimation(m, rec, animPtr);

  // Nudge the launcher's step field (+0x08) down by 0x10 — a recoil/pacing tweak applied to the
  // firing enemy's movement sub-position as it throws.
  mem8[rec + 0x08] = mem8[rec + 0x08] - 0x10; // nudge launcher step

  // Seed the new projectile record's fixed fields:
  //   +0x00 = 0x01 — mark the slot live (sets bit 0 of the presence header so the actor sweep
  //                  then picks it up).
  //   +0x02 = 0x0b — state index: the projectile's entry point into its own state machine.
  //   +0x07 = 0x01 — facing / animation-variant flag.
  mem8[slot + 0x00] = 0x01; // active
  mem8[slot + 0x02] = 0x0b;
  mem8[slot + 0x07] = 0x01;

  // Select the projectile's animation-stream (its on-screen sprite / hit-flash sequence). The
  // default is 0x3bdd. When the alternate play-mode latch PLAY_MODE_LATCH (0x8f50) is nonzero a
  // different sequence is used — 0x433b, upgraded to 0x4341 when ROUND_COUNTER (0x8907) bit 2 is
  // set. The chosen ROM pointer is then stored little-endian into the record's animation-stream
  // fields +0x0c (low) and +0x0d (high).
  // hit-flash sequence: default, or one of two play-mode variants
  let flashPtr = HIT_FLASH_ANIM_3BDD;
  if (mem8[PLAY_MODE_LATCH] !== 0) {
    flashPtr = HIT_FLASH_ANIM_433B;
    if (mem8[ROUND_COUNTER] & 0x04) flashPtr = HIT_FLASH_ANIM_4341;
  }
  mem8[slot + 0x0c] = flashPtr; // low byte
  mem8[slot + 0x0d] = flashPtr >> 8; // high byte

  // Finish initialising the projectile record:
  //   +0x0e = 0x00 — clear the animation frame-hold countdown so the first frame shows at once.
  //   +0x16 = 0x00 — clear the armed/phase bit.
  //   +0x11 = 0x13 — seed the frame-delay that paces the projectile's state transitions.
  //   +0x14/+0x15 = rec — store a back-pointer to the launcher record (little-endian), so the
  //                  projectile can be tied back to the enemy that fired it.
  mem8[slot + 0x0e] = 0x00;
  mem8[slot + 0x16] = 0x00;
  mem8[slot + 0x11] = 0x13;
  mem8[slot + 0x14] = rec; // launcher pointer, low byte
  mem8[slot + 0x15] = rec >> 8; // launcher pointer, high byte

  // Advance the rotating display attribute. Bump the shared attribute index SPAWN_ATTR_INDEX
  // (0x8d6c) and mask it to 0..7, so successive launches step through the attribute table. As
  // with the coordinate table the table itself is round-selected: ROUND_COUNTER (0x8907) bit 0
  // picks 0x3b3f, otherwise 0x3b37. The looked-up attribute byte is written back onto the
  // launcher's own display-attribute field (+0x15), cycling the firing enemy's colour/attribute.
  // rotating display attribute stored back on the launcher
  mem8[SPAWN_ATTR_INDEX] = mem8[SPAWN_ATTR_INDEX] + 1;
  const attrIndex = mem8[SPAWN_ATTR_INDEX] & 0x07;
  const attrTable = mem8[ROUND_COUNTER] & 0x01 ? SPAWN_ATTR_TABLE_3B3F : SPAWN_ATTR_TABLE_3B37;
  const [attr] = fetchByteFromTableIndex(m, attrTable, attrIndex);
  mem8[rec + 0x15] = attr;
}
