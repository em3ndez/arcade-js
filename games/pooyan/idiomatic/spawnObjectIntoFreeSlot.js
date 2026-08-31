// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { mergeActorAttributeByte } from "./mergeActorAttributeByte.js";
import { spawnActorSlotFromTemplate } from "./spawnActorSlotFromTemplate.js";
import {
  SLOT_SPAWN_INDEX,
  ACTIVE_LANE_COUNT,
  LANE_SPAWN_COUNTDOWN,
  loc_8d76,
  ANIM_FRAME_COUNTER,
  ANIM_SEQ_3988,
  ANIM_SEQ_3994,
} from "./names.js";
/**
 * spawnObjectIntoFreeSlot -- claim the first free record in an actor pool and spawn a new actor into it.
 *
 * WHAT IT IS
 *   The shared free-slot allocator behind the wave/lane spawn machinery. A caller describes a pool to
 *   scan -- a base record address, the byte stride between records, and how many records to try -- plus
 *   a "template" record holding the flags, animation and timing of the actor it wants created. This
 *   routine finds the first record in the pool whose two-byte header is inactive and, when it finds
 *   one, stamps the spawn bookkeeping and the template's animation/timing fields, then hands the found
 *   record and the finished template to the slot initialiser that copies the new actor into place.
 *
 * ROLE IN THE MACHINE
 *   Actors are allocated one-per-pass: the pool is swept for something empty and that record is filled
 *   in place, so exactly one actor appears per eligible call. This is the allocator the lane-spawn path
 *   relies on -- when the template is tagged as a lane actor (its flag byte +0x07 bit2) the routine
 *   also draws down the pool of activated lanes and (re)arms the wave's spawn pacer, which throttles
 *   the next spawn and, while it is non-zero, suppresses enemy fire. Every spawn that passes through
 *   here also steps the machine-wide animation-frame id so successive actors are handed staggered
 *   animation phases (and distinct sprite ids downstream).
 *
 * ROM 0x3680-0x36db.
 * Grounding: [seen].
 *
 * LIVE-OUT: the actor pool -- one free (inactive) record is filled in and marked live by the slot
 *   initialiser. Along the way it also leaves updated spawn bookkeeping in work RAM: the per-slot spawn
 *   tally SLOT_SPAWN_INDEX (0x8d7b) bumps whenever the lane flag is armed; the activated-lane count
 *   ACTIVE_LANE_COUNT (0x8d79), the lane-spawn pacer LANE_SPAWN_COUNTDOWN (0x8d75) and its companion
 *   reset latch (0x8d76) are updated only while lanes remain; and the global animation-frame counter
 *   ANIM_FRAME_COUNTER (0x8d41) steps by one, never resting on 0. The caller reads no register back;
 *   the hit path merely forwards the slot initialiser's value result as a harmless byproduct.
 */

// The fresh actor's countdown timer, stamped into template field +0x11 (see the field-seed step
// below). It gates when the new actor next advances/fires; the ROM seeds every spawn with 0x28.
const SPAWN_TIMER = 0x28; // template +0x11

export function spawnObjectIntoFreeSlot(m, base = m.regs.iy, stride = m.regs.de, count = m.regs.b, template = m.regs.ix) {
  const { mem8 } = m;

  // --- Find a free record (ROM 0x3680-0x368d) ---
  // Walk the pool from `base`, at most `count` records apart by `stride`. A record is "free" when the
  // low bit (bit0) of its two header bytes -- +0x00 OR'd with +0x01 -- is clear; bit0 set means a live
  // actor already owns that record. The scan stops at the first free record it meets, so a caller that
  // keeps its live actors packed at the front naturally lands on the first hole. Exhausting all `count`
  // records without a hit means the pool is full and nothing can be spawned this pass.
  let slot = base;
  let remaining = count & 0xff;
  let found = false;
  for (;;) {
    if (((mem8[slot + 0x00] | mem8[slot + 0x01]) & 0x01) === 0) { found = true; break; }
    slot = u16(slot + stride);
    remaining = (remaining - 1) & 0xff;
    if (remaining === 0) break; // table full -- no slot
  }
  if (!found) return; // table full

  // --- Lane bookkeeping when this is a lane actor (ROM 0x3696-0x36af) ---
  // The template's flag byte +0x07 bit2 marks an actor that belongs to the lane-spawn sequence. For
  // those, bump the per-slot spawn tally SLOT_SPAWN_INDEX (0x8d7b) -- a running index other spawn code
  // uses to pick alternating target columns / animation sources. Then, while activated lanes remain,
  // consume one: decrement ACTIVE_LANE_COUNT (0x8d79), and seed the lane-spawn pacer LANE_SPAWN_COUNTDOWN
  // (0x8d75) with the pre-decrement lane count (so the pacer counts down over exactly the lanes that
  // were still pending), and clear the companion lane-reset latch at 0x8d76. When no lanes remain the
  // pacer/latch are left untouched.
  if ((mem8[template + 0x07] & 0x04) !== 0) { // +7 bit2 armed
    mem8[SLOT_SPAWN_INDEX] = mem8[SLOT_SPAWN_INDEX] + 1;
    const lanes = mem8[ACTIVE_LANE_COUNT];
    if (lanes !== 0) {
      mem8[ACTIVE_LANE_COUNT] = lanes - 1;
      mem8[LANE_SPAWN_COUNTDOWN] = lanes; // seed the pacer with the pre-decrement lane count
      mem8[loc_8d76] = 0x00;
    }
  }

  // --- Advance the animation-frame id (ROM 0x36af-0x36ba) ---
  // Step the machine-wide animation-frame counter ANIM_FRAME_COUNTER (0x8d41) by one and skip the
  // value 0 on wrap -- 0 is reserved (it doubles as a "no sprite" id downstream), so the counter runs
  // 1..255 and rolls straight from 255 back to 1. The stepped value is both stored back and written to
  // the template's +0x14 field, tagging this actor with the current frame id so it later indexes its
  // tile column / animation phase and each successive spawn is staggered.
  let frameId = (mem8[ANIM_FRAME_COUNTER] + 1) & 0xff;
  if (frameId === 0) frameId = 0x01; // wrapped to 0 -> skip it
  mem8[ANIM_FRAME_COUNTER] = frameId;
  mem8[template + 0x14] = frameId;

  // --- Seat the animation vector and the fixed spawn fields (ROM 0x36bd-0x36d8) ---
  // Choose which ROM animation-sequence descriptor the new actor runs from the template's flag byte
  // +0x07 bit1: set picks ANIM_SEQ_3994 (0x3994, the turn/variant sequence), clear picks ANIM_SEQ_3988
  // (0x3988, the default). The 16-bit descriptor pointer is stored little-endian into the actor record
  // at +0x0c (low) / +0x0d (high). The remaining fields are constants every spawn shares: +0x0e cleared
  // (animation sub-step / offset), +0x11 the spawn/action countdown SPAWN_TIMER (0x28), and +0x02 the
  // initial state byte 0x04.
  const animVector = (mem8[template + 0x07] & 0x02) !== 0 ? ANIM_SEQ_3994 : ANIM_SEQ_3988;
  mem8[template + 0x0c] = animVector; //               animation-sequence pointer, low byte
  mem8[template + 0x0d] = (animVector >> 8); //         ...high byte
  mem8[template + 0x0e] = 0x00;
  mem8[template + 0x11] = SPAWN_TIMER;
  mem8[template + 0x02] = 0x04;

  // --- Finish: build the attribute byte, then initialise the found record (ROM 0x36de, jp 0x379d) ---
  // Compose the actor's on-screen attribute/colour byte into template field +0x08 (colour set plus the
  // flip/phase bits, via the flag/phase/stage lookups the attribute builder applies), then initialise
  // the free record found above from the fully-seeded template. That final step is the actor's tail:
  // it stamps the record live and copies the template in, and its value result is passed straight back.
  mergeActorAttributeByte(m, template); // build the attribute byte at +0x08
  return spawnActorSlotFromTemplate(m, slot, template, frameId); // tail: initialise the found slot
}
