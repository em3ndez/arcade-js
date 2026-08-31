// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { SPAWN_OBJECT_TABLE, WAVE_ARRIVAL_COUNTER, SHARED_FRAME_DELAY_TIMER, ANIM_TABLE_3838 } from "./names.js";
/**
 * descendEnemyActorAndSeatSpawnSlot — one descent step for an enemy-actor record.
 *
 * WHAT IT IS
 *   A per-record state handler for an enemy actor. The record it works on lives at `rec`
 *   (an 0x18-byte struct); the handler is called once per frame while this actor is in its
 *   descending state. Each call it does three things in order: animates the actor one frame,
 *   drops the actor a notch down the screen by integrating a 16-bit sub-position, and — as the
 *   actor passes each row on the way down — tries to hand a matching free spawn-object slot the
 *   coordinates it has reached, effectively "dropping" a spawn object at that row.
 *
 * ROLE IN THE MACHINE
 *   This is the descent leg of the enemy-actor lifecycle. The actor falls one landing-row height
 *   (0x18) per completed step. Below the landing row it looks for a spawn-object slot parked at the
 *   actor's current row and, when it finds one, seats a spawned object there and counts a wave
 *   arrival. Once the actor reaches (or has already passed) the landing row it stops hunting for a
 *   slot and simply completes the step: it advances its own state byte, reloads the descent step,
 *   and restarts its animation.
 *
 * ROM 0x672a-0x679f.  Grounding: [seen].
 *
 * LIVE-OUT: none consumed by the caller (this routine communicates only through memory).
 *   It writes: the record's 16-bit sub-position (rec+5/rec+6), state (rec+2), step (rec+9), and
 *   back-link (rec+7/rec+8); one spawn-object slot (active flag, X/Y coordinates, init byte) in
 *   SPAWN_OBJECT_TABLE; the wave-arrival counter WAVE_ARRIVAL_COUNTER; and the shared frame-delay
 *   timer SHARED_FRAME_DELAY_TIMER. advanceObjectAnimationFrame and setActorAnimation also work
 *   through the record only. None of the scratch used here is read back by the caller.
 */

// --- Enemy-actor record layout (relative to `rec`) -------------------------------------------
const POS_LOW = 0x05; //   sub-position low byte: the fractional/fine descent accumulator (adds the step)
const POS_HIGH = 0x06; //  sub-position high byte: the actor's current descent row (bumped on carry)
const STEP = 0x09; //      per-frame descent step added to the sub-position (reloaded to ROW_HEIGHT each step)
const STATE = 0x02; //     record state byte, bumped once this descent step completes
const X_SRC = 0x03; //     the actor's X coordinate, biased and copied into the seated slot
const LINK_LO = 0x07; //   low byte of the back-link to the slot this actor last seated
const LINK_HI = 0x08; //   high byte of that back-link

// --- Landing row / spawn-slot geometry -------------------------------------------------------
const ROW_HEIGHT = 0x18; // one landing-row height; also the slot-table stride and the reloaded step
const SLOT_ACTIVE_FLAG = 0x01; // slot offset: presence/active flag (0 == free)
const SLOT_ROW = 0x06; //        slot offset: the row this slot is parked at (matched against the actor's row)
const SLOT_X = 0x03; //          slot offset: seated X low byte
const SLOT_X_HI = 0x04; //       slot offset: seated X high byte (borrowed into when X underflows)
const SLOT_Y = 0x05; //          slot offset: seated Y low byte
const SLOT_Y_HI = 0x06; //       slot offset: seated Y high byte (same field as SLOT_ROW; decremented on carry)
const SLOT_INIT = 0x0f; //       slot offset: per-object init byte written on seat
const SLOT_COUNT = 3; //         spawn-object slots scanned (the table holds three)
const SLOT_SEATED = 0x02; //     value written to the active flag to mark a slot seated
const SLOT_INIT_VALUE = 0xc0; // the init byte seeded into a freshly seated slot
const X_BIAS = 0x80; //          subtracted from the source X on seat (an underflow borrows into the high byte)
const Y_BIAS = 0x40; //          added to the sub-position low on seat (a carry decrements the Y high byte)
const SEAT_TIMER_SEED = 0x20; // value armed into the shared frame-delay timer when a slot is seated

export function descendEnemyActorAndSeatSpawnSlot(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Step the actor's current animation by one frame (frame-hold countdown + script walk).
  advanceObjectAnimationFrame(m, rec);

  // Integrate the 16-bit descent sub-position: add the per-frame step to the low byte, and when
  // that overflows past a byte carry one row into the high byte (rec+6). The high byte is the
  // actor's descent row; the low byte is the fine accumulator that carries into it.
  const pos = mem8[rec + POS_LOW] + mem8[rec + STEP];
  if (pos > 0xff) mem8[rec + POS_HIGH] = (mem8[rec + POS_HIGH] + 1);
  mem8[rec + POS_LOW] = pos;

  // While the actor is still above the landing row, look for a spawn-object slot to seat at the
  // actor's current row. At or below the landing row this whole block is skipped and the step just
  // completes below.
  if (mem8[rec + POS_HIGH] < ROW_HEIGHT) {
    // Scan the three-slot spawn-object table (base SPAWN_OBJECT_TABLE, stride ROW_HEIGHT) for a
    // slot that is free (its active flag is 0) AND parked at the actor's current row (its row byte
    // equals rec+6).
    let slot = SPAWN_OBJECT_TABLE;
    let seated = false;
    for (let i = 0; i < SLOT_COUNT; i++) {
      if (mem8[slot + SLOT_ACTIVE_FLAG] === 0 && mem8[slot + SLOT_ROW] === mem8[rec + POS_HIGH]) {
        seated = true;
        break;
      }
      slot += ROW_HEIGHT;
    }
    // No free slot matches this row this frame. Leave immediately WITHOUT completing the step, so
    // the state byte and step are untouched and the actor retries the same row next frame.
    if (!seated) return; // no free matching slot -> nothing seated

    // A matching free slot exists: seat a spawn object into it and count the arrival.
    // Bump the per-stage wave-arrival counter WAVE_ARRIVAL_COUNTER (0x8903).
    mem8[WAVE_ARRIVAL_COUNTER] = (mem8[WAVE_ARRIVAL_COUNTER] + 1);
    // Mark the slot occupied.
    mem8[slot + SLOT_ACTIVE_FLAG] = SLOT_SEATED;

    // Seat the slot's X from the actor's X, biased down by X_BIAS (0x80). An underflow past zero
    // borrows one out of the slot's X high byte, keeping the 16-bit X coherent; the low byte wraps.
    const x = mem8[rec + X_SRC] - X_BIAS;
    if (x < 0) mem8[slot + SLOT_X_HI] = (mem8[slot + SLOT_X_HI] - 1); // borrow
    mem8[slot + SLOT_X] = x;

    // Seat the slot's Y from the actor's sub-position low, biased up by Y_BIAS (0x40). A carry out
    // of the low byte DECREMENTS the slot's Y high byte (the Y high byte counts opposite to the low
    // byte's carry here), then the low byte wraps into the slot's Y field.
    const y = mem8[rec + POS_LOW] + Y_BIAS;
    if (y > 0xff) mem8[slot + SLOT_Y_HI] = (mem8[slot + SLOT_Y_HI] - 1); // carry decrements
    mem8[slot + SLOT_Y] = y;

    // Seed the slot's init byte, then link the slot's address back into the actor record (low byte
    // to rec+7, high byte to rec+8) so the actor remembers the slot it just seated.
    mem8[slot + SLOT_INIT] = SLOT_INIT_VALUE;
    mem8[rec + LINK_LO] = slot;
    mem8[rec + LINK_HI] = (slot >> 8);
    // Arm the shared frame-delay timer (0x8929), which gates the object-update sweeps until it drains.
    mem8[SHARED_FRAME_DELAY_TIMER] = SEAT_TIMER_SEED;
  }

  // Complete the descent step (reached on a seated slot or once the landing row is reached):
  // advance the actor's state byte, reload the per-frame step to a full row height, and restart the
  // animation on ANIM_TABLE_3838 (0x3838).
  mem8[rec + STATE] = (mem8[rec + STATE] + 1);
  mem8[rec + STEP] = ROW_HEIGHT;
  setActorAnimation(m, rec, ANIM_TABLE_3838);
}
