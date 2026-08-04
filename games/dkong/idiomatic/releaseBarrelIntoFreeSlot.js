// SPDX-License-Identifier: GPL-3.0-only
/**
 * releaseBarrelIntoFreeSlot — claim the free 25m barrel slot the caller's scan stopped on:
 * mark the record occupied, aim the renderer at it and at its sprite slot, and charge the
 * release against the bonus.
 *
 * The head of the barrel-release cluster. The scan above it walks the ten barrel records
 * counting down, and jumps here the moment it finds one whose low two flag bits are both
 * clear — a free slot. This routine turns that slot into a released barrel:
 *
 *   1. Publishes the record as RENDER_OBJ_PTR, the object the rest of the chain dresses and
 *      renders.
 *   2. Stamps the record's OBJ_ACTIVE field with 2 — bit 1, "occupied". That is what stops
 *      the next pass's scan re-claiming the same slot; the movement code later replaces it
 *      with 1, bit 0, "active", when the barrel starts moving.
 *   3. Works out the slot's index — the scan's countdown runs ten down to one across records
 *      0..9, so ten-minus-the-count is the record's index — and stores the matching slot of
 *      the ten-record sprite group ACTOR_SPRITES into RENDER_DST_PTR. That is the address the
 *      renderer later writes four-byte sprite records to, so barrel record k renders into
 *      sprite slot k.
 *   4. Sets bit 0 of the cluster's event gate, the byte the cluster's entry points test:
 *      while it is set the scan hands straight to the renderer instead of looking for another
 *      free slot, and the release scheduler skips its pass. The renderer's terminator clears
 *      it again — so it is a one-shot "a barrel went out this pass" latch.
 *   5. Charges the release: posts the deferred task that takes one notch off the on-screen
 *      bonus readout, then decrements the BONUS counter itself. ON 25m THIS ROUTINE IS THE
 *      BONUS CLOCK: on the other boards the counter is driven by a timed decrementer, but on
 *      25m the bonus falls per barrel released, not per unit of time. When that decrement
 *      reaches zero it raises BONUS_EXPIRED_STEP, starting the bonus-expired sequence.
 *
 * Both arms then continue into the rest of the chain with the counter's address still in the
 * pointer register — which is exactly the byte the continuation reads, so it sees the
 * post-charge count.
 *
 * NOT CLAIMED: which named Donkey Kong object either barrel kind is. That is the downstream
 * kind stamper's business, and it describes them only as observed behaviour.
 *
 * OFFSET NAMESPACE. The index register points at an OBJECT record, so its +0 is the
 * object-record OBJ_ACTIVE — NOT the sprite-record X field that shares the numeric offset 0,
 * and not the hammer flag scoped to a different record array. The destination this routine
 * COMPUTES is in the other namespace: ACTOR_SPRITES is a group of hardware sprite records, so
 * the stride that scales the index is the four-byte sprite-record stride, not the
 * object-record stride the scan above uses.
 *
 * LIVE-OUT: memory-only — the claimed record, the two render pointers, the event gate, the
 * task ring, the bonus counter and its expiry latch, plus everything the continuation writes.
 * No register is live-out: every one this routine leaves is overwritten downstream before it
 * is read.
 */

import { u8 } from "../../../core/int.js";
import {
  RENDER_OBJ_PTR, RENDER_DST_PTR, ACTOR_SPRITES, OBJ_ACTIVE, BONUS, BONUS_EXPIRED_STEP,
} from "./names.js";
import { enqueueTask } from "./enqueueTask.js"; // post a deferred [opcode, argument]
import { loc_2ce6 } from "./loc_2ce6.js"; // the rest of the cluster chain

// bit0 SET -> a release happened this pass. The cell carries no shared name — it is shared
// engine scratch — so it is file-local here.
const EVENT_GATE = 0x6393;
const SLOT_CLAIMED = 2; // OBJ_ACTIVE bit 1 = occupied; the movement code replaces it with 1 (active)
const BARREL_SLOTS = 10; // barrel records, and slots in ACTOR_SPRITES
const SPRITE_RECORD_BYTES = 4; // stride of a hardware sprite record
const BONUS_TASK_OPCODE = 5; // task-ring opcode 5 -> dispatch table entry 10, the bonus-readout handler
const BONUS_TASK_STEP_DOWN = 1; // its "take one notch off the readout" arm (argument 0 pays the bonus out)

export function releaseBarrelIntoFreeSlot(m) {
  const { regs, mem } = m;

  const record = regs.ix; // the free barrel record the caller's scan stopped on

  // Claim the slot: publish it as the renderer's current object and mark it occupied, which is
  // what stops the next scan re-claiming it.
  mem.write16(RENDER_OBJ_PTR, record);
  mem.write8(record + OBJ_ACTIVE, SLOT_CLAIMED);

  // The scan counts the ten barrel records down as it walks them, so ten-minus-the-count is the
  // index of the record it stopped on. Point the renderer at the matching sprite slot; the
  // scaled index is carried as a single byte.
  const slotOffset = u8((BARREL_SLOTS - regs.b) * SPRITE_RECORD_BYTES);
  mem.write16(RENDER_DST_PTR, ACTOR_SPRITES + slotOffset);

  // Latch "a barrel went out this pass" — while this bit is set the cluster's entry points hand
  // straight to the renderer; the renderer's terminator clears it again.
  mem.write8(EVENT_GATE, 1);

  // Charge the release against the bonus. First the deferred task that steps the on-screen
  // readout down one notch; enqueueTask takes the message in the D/E pair.
  regs.d = BONUS_TASK_OPCODE;
  regs.e = BONUS_TASK_STEP_DOWN;
  enqueueTask(m);

  // Then the counter itself: on 25m releasing a barrel IS the bonus tick. Hitting zero starts
  // the bonus-expired sequence.
  const remaining = u8(mem.read8(BONUS) - 1);
  mem.write8(BONUS, remaining);
  if (remaining === 0) mem.write8(BONUS_EXPIRED_STEP, 1);

  // Continue into the rest of the chain. The continuation reads the counter through the
  // pointer register, so hand it the counter's address — it sees the post-charge count.
  regs.hl = BONUS;
  return loc_2ce6(m);
}
