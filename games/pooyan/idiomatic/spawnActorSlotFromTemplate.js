// SPDX-License-Identifier: GPL-3.0-only
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { queueSoundCommand04IfNotBusy } from "./queueSoundCommand04IfNotBusy.js";
import {
  DIFFICULTY_DSW,
  SPEED_INDEX,
  ROUND_COUNTER,
  SPEED_TABLE_38A5,
  SPEED_TABLE_38AD,
  ANIM_PTR_TABLE_38B5,
  ANIM_SEQ_3952,
} from "./names.js";
/**
 * spawnActorSlotFromTemplate — birth one live actor into a fresh record slot from a template record.
 *
 * WHAT IT IS
 *   Pooyan keeps every on-screen actor (the player, enemy pigs/wolves, projectiles, rope/formation
 *   pieces) in a 0x18-byte record. When the game needs a new actor it hands this routine two records:
 *   a *template* record that carries the desired starting coordinates and animation choice, and an
 *   empty *slot* record to fill in. This routine stamps the slot with the fixed birth values, copies
 *   the template's position (with the biases that convert template space into on-screen sprite space),
 *   picks the actor's travel speed out of the difficulty-selected speed table, chooses its animation
 *   stream, and marks the slot live so the per-frame arena sweep starts driving it. It is the shared
 *   "construct an actor" primitive the spawners call.
 *
 * ROLE IN THE MACHINE
 *   The slot (record base) arrives in IY, the template in IX, and the actor's collision key in C.
 *   All the seeded offsets are the standard record layout: +0x00 presence, +0x02 state index,
 *   +0x04 Y coordinate, +0x07 facing/anim-variant flag, +0x0a facing-negation (velocity), +0x0b anim
 *   flag, +0x0c/+0x0d animation-stream pointer, +0x0e frame-hold, +0x11 frame-delay, +0x14 collision
 *   key. Once stamped, the record is a fully-formed actor the arena dispatcher will step.
 *
 * ROM 0x379d-0x381d.  GROUNDING: [seen].
 *
 * LIVE-OUT (what it leaves in memory):
 *   - the slot record at IY, seeded into a live actor (presence +0x00=1, initial state +0x02=4,
 *     collision key +0x14=C, biased position +0x03/+0x04/+0x05/+0x06, velocity +0x0a, anim flag
 *     +0x0b, anim-stream pointer +0x0c/+0x0d, cleared facing/frame-hold +0x07/+0x0e, spawn frame
 *     delay +0x11=0x28);
 *   - the template's +0x0a, mirrored with the same velocity so the parent record tracks the child's
 *     heading.
 *   The value handed back is only the spawn-sound helper's result and is not read by the caller; the
 *   collision key C is an input, not an output.
 */

const POS_BIAS = 0x80; //     bias added to the copied position bytes to move template space into sprite space
const SPEED_CLAMP = 0x08; //  speed index saturates at/above this value...
const SPEED_MAX = 0x07; //    ...down to this, the last valid speed-table entry
const HARD_DSW = 0x07; //     DIFFICULTY_DSW value that selects the faster (hard) speed table
const SPAWN_TIMER = 0x28; //  initial frame-delay stamped into record +0x11

export function spawnActorSlotFromTemplate(m, slot = m.regs.iy, template = m.regs.ix, c = m.regs.c) {
  const { mem8 } = m;

  // Fixed birth fields. Every new actor starts with the same header regardless of template:
  //   +0x00 = 1  -> presence bit set, so the arena sweep treats the record as live and begins stepping it;
  //   +0x02 = 4  -> starting state index for its per-record state machine (masked to 5 bits by the dispatcher);
  //   +0x14 = C  -> collision key, the byte a projectile hit is matched against;
  //   +0x07 = 0  -> facing / animation-variant flag cleared (default variant);
  //   +0x0e = 0  -> frame-hold countdown cleared (advance animation on the next frame).
  mem8[slot + 0x00] = 0x01;
  mem8[slot + 0x02] = 0x04;
  mem8[slot + 0x14] = c;
  mem8[slot + 0x07] = 0x00;
  mem8[slot + 0x0e] = 0x00;

  // Copy the template's four position bytes into the slot with fixed biases. The template stores
  // coordinates in its own frame; +0x80 recentres the +0x05/+0x03 position bytes into on-screen
  // sprite space, and the -1 / +1 nudges place the +0x04 (Y coordinate) and +0x06 companion byte on
  // the exact spawn pixel row/column the spawners expect.
  mem8[slot + 0x05] = (mem8[template + 0x05] + POS_BIAS);
  mem8[slot + 0x03] = (mem8[template + 0x03] + POS_BIAS);
  mem8[slot + 0x04] = (mem8[template + 0x04] - 0x01);
  mem8[slot + 0x06] = (mem8[template + 0x06] + 0x01);

  // Select the enemy speed magnitude table by difficulty. DIFFICULTY_DSW (0x8820) is the 3-bit
  // complemented DSW1 difficulty; its hardest setting (7) uses the faster table SPEED_TABLE_38AD
  // (0x38ad), every other setting uses SPEED_TABLE_38A5 (0x38a5).
  const speedTable = mem8[DIFFICULTY_DSW] === HARD_DSW ? SPEED_TABLE_38AD : SPEED_TABLE_38A5;
  // Index into that table with SPEED_INDEX (0x8900), the wave/round escalation counter, clamped so
  // it can never run past the 8-entry table: anything >= 8 saturates to the last entry (7).
  let speedIndex = mem8[SPEED_INDEX];
  if (speedIndex >= SPEED_CLAMP) speedIndex = SPEED_MAX;
  // Fetch the speed magnitude byte at speedTable[speedIndex] (ROM byte-table lookup at 0x38a5/0x38ad).
  const [speed] = fetchByteFromTableIndex(m, speedTable, speedIndex);

  // Turn the magnitude into a signed velocity. ROUND_COUNTER (0x8907) bit0 selects the facing
  // variant for the round: on an odd round the actor travels the other way, so the magnitude is
  // two's-complement negated. This is the +0x0a "facing-negation" byte.
  let velocity = speed;
  if ((mem8[ROUND_COUNTER] & 0x01) !== 0) velocity = (-velocity) & 0xff; // mirrored facing
  // Store the velocity into the slot's +0x0a and mirror it back into the template's +0x0a, so the
  // parent record's heading matches the child it just spawned.
  mem8[slot + 0x0a] = velocity;
  mem8[template + 0x0a] = velocity;

  // Choose the animation stream. The high nibble of the template's +0x07 flag is the frame selector;
  // it indexes the little-endian pointer table ANIM_PTR_TABLE_38B5 (0x38b5) to get the animation
  // stream pointer for this actor's shape.
  const frame = mem8[template + 0x07] >> 4;
  const looked = fetchWordFromTableIndex(m, frame, ANIM_PTR_TABLE_38B5);
  // The template's +0x0b flag can override that choice: when nonzero the actor uses the fixed spawn
  // animation sequence ANIM_SEQ_3952 (0x3952) instead of the table-looked-up stream.
  const flag = mem8[template + 0x0b];
  const animVector = flag === 0 ? looked : ANIM_SEQ_3952;
  // Commit the animation choice and the remaining birth fields:
  //   +0x0b = the anim flag itself;
  //   +0x0c/+0x0d = the animation-stream pointer, stored little-endian (low byte then high byte);
  //   +0x11 = the spawn frame delay that paces the actor's first transitions.
  mem8[slot + 0x0b] = flag;
  mem8[slot + 0x0c] = animVector; //                animation-stream pointer, low byte
  mem8[slot + 0x0d] = (animVector >> 8); //         ...high byte
  mem8[slot + 0x11] = SPAWN_TIMER;

  // Announce the spawn: hand off to the spawn-sound enqueue, which appends sound command 0x04 to the
  // audio command ring unless a wave-teardown/grab is in progress. Its return value is incidental.
  return queueSoundCommand04IfNotBusy(m); // tail: conditionally enqueue the spawn sound
}
