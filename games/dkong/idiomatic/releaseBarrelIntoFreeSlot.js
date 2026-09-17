// SPDX-License-Identifier: GPL-3.0-only
/**
 * releaseBarrelIntoFreeSlot — claim the free 25m barrel slot the caller's scan stopped on
 * (regs.ix): publish it as RENDER_OBJ_PTR, mark OBJ_ACTIVE occupied (bit 1), aim RENDER_DST_PTR
 * at the matching ACTOR_SPRITES slot, latch the cluster event gate, and charge the release
 * against the bonus (post the readout-step task, then decrement BONUS; on 25m this is the bonus
 * clock, so hitting zero raises BONUS_EXPIRED_STEP). Continues into the cluster chain with the
 * counter's address in regs.hl.
 *
 * LIVE-OUT: memory-only — the claimed record, the two render pointers, the event gate, the task
 * ring, the bonus counter and its expiry latch, plus everything the continuation writes.
 */

import { u8 } from "../../../core/int.js";
import {
  RENDER_OBJ_PTR, RENDER_DST_PTR, ACTOR_SPRITES, OBJ_ACTIVE, BONUS, BONUS_EXPIRED_STEP,
} from "./names.js";
import { enqueueTask } from "./enqueueTask.js";
import { loc_2ce6 } from "./loc_2ce6.js";

const EVENT_GATE = 0x6393;      // bit0 SET -> a release happened this pass (shared engine scratch)
const SLOT_CLAIMED = 2;         // OBJ_ACTIVE bit 1 = occupied
const BARREL_SLOTS = 10;
const SPRITE_RECORD_BYTES = 4;
const BONUS_TASK_OPCODE = 5;
const BONUS_TASK_STEP_DOWN = 1;

export function releaseBarrelIntoFreeSlot(m) {
  const { regs, mem8, mem16 } = m;

  const record = regs.ix;

  mem16[RENDER_OBJ_PTR] = record;
  mem8[record + OBJ_ACTIVE] = SLOT_CLAIMED;

  // Ten-minus-the-scan-count is the record's index; carried as a single byte.
  const slotOffset = u8((BARREL_SLOTS - regs.b) * SPRITE_RECORD_BYTES);
  mem16[RENDER_DST_PTR] = ACTOR_SPRITES + slotOffset;

  mem8[EVENT_GATE] = 1;

  regs.d = BONUS_TASK_OPCODE;
  regs.e = BONUS_TASK_STEP_DOWN;
  enqueueTask(m);

  const remaining = u8(mem8[BONUS] - 1);
  mem8[BONUS] = remaining;
  if (remaining === 0) mem8[BONUS_EXPIRED_STEP] = 1;

  regs.hl = BONUS;
  return loc_2ce6(m);
}
