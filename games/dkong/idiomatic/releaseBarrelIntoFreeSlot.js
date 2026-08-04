// SPDX-License-Identifier: GPL-3.0-only
/**
 * releaseBarrelIntoFreeSlot — claim the free 25m barrel slot the caller's scan stopped on: mark the record
 * occupied, aim the renderer at it and at its sprite slot, and charge the release against the
 * bonus.  ROM 0x2CB8.
 *
 * The head of the 0x2C cluster. The scan above it (ROM 0x2C8F) walks the ten OBJ_ARRAY_67
 * barrel records counting down and jumps here the moment it finds one whose low two flag bits
 * are both clear — a free slot. This routine turns that slot into a released barrel:
 *
 *   1. Publishes the record as RENDER_OBJ_PTR, the object the rest of the chain dresses and
 *      renders.
 *   2. Stamps the record's OBJ_ACTIVE field with 2 — bit 1, "occupied". That is what stops the
 *      next pass's scan re-claiming the same slot; the movement code later replaces it with 1
 *      (bit 0, "active") when the barrel starts moving.
 *   3. Works out the slot's index — the scan's countdown runs 10 down to 1 across records 0..9,
 *      so ten-minus-the-count is the record's index — and stores the matching slot of the
 *      ten-record sprite group ACTOR_SPRITES into RENDER_DST_PTR. That is the address stepBarrelAlongReleasePath
 *      later writes 4-byte sprite records to, so barrel record k renders into sprite slot k.
 *   4. Sets bit 0 of the cluster's event gate (0x6393), the byte the cluster's entry points
 *      test: while it is set the scan at ROM 0x2C8F hands straight to the renderer instead of
 *      looking for another free slot, and scheduleBarrelRelease skips its pass. The renderer's terminator
 *      (activateReleasedBarrel) clears it again — so it is a one-shot "a barrel went out this pass" latch.
 *   5. Charges the release: posts the deferred task that takes one notch off the on-screen
 *      bonus readout, then decrements the BONUS counter itself. ★ ON 25m THIS ROUTINE IS THE
 *      BONUS CLOCK — names.js records BONUS as ticking down either by the timed decrementer
 *      (boards 2/3/4, ROM 0x2FCB) or "by the barrel-release routine (board 1, ROM 0x2CB8)",
 *      i.e. here. So on 25m the bonus falls per barrel released, not per unit of time.
 *      When that decrement reaches zero it raises BONUS_EXPIRED_STEP, starting the
 *      bonus-expired sequence.
 *
 * Both arms then continue into loc_2ce6 with the counter's address still in the pointer
 * register — which is exactly the byte loc_2ce6 reads, so it sees the post-charge count.
 *
 * GROUNDED — live MAME 0.288 on the real dkong ROM, understanding pass 12
 * (scratchpad/pass12-grounding.md §2). This is ORDINARY 25m BARREL PLAY, not a cutscene; the
 * older "0x2C-cluster cutscene renderer" framing is REFUTED:
 *   - 46 dispatches of the next link stampReleasedBarrelKind, every one at a gameplay substate
 *     (17 credited in-board 25m, 29 attract 25m demo) and ZERO at substate 7, the opening
 *     Kong-climb cutscene, which ran 769 + 512 frames in the same runs without firing it.
 *   - Board 1 only: 0 dispatches across 6667 frames each of poked 50m and 75m.
 *   - Each of those 46 was preceded IN THE SAME FRAME by a slot claim here — 46 claims / 46
 *     dispatches, none unmatched either way — with the scan's countdown walking 10, 9, 8, 7…,
 *     and each claim decremented BONUS (observed on screen as 4900 -> 4800).
 *   - The record this routine claims is an OBJ_ARRAY_67 barrel record: RENDER_OBJ_PTR, the word
 *     written here, held only 0x6700 / 0x6720 / 0x6740 / 0x6760 / 0x6780 / 0x67A0 / 0x67C0 and
 *     matched the index register at 46/46 dispatches.
 *   - The claim VALUE was watched directly: a freshly claimed record sits at OBJ_ACTIVE == 2
 *     for ~28 frames and then flips to 1 when it starts moving (RUN-E, natural play).
 * HONESTY BOUND, kept deliberately: the run did NOT establish which NAMED Donkey Kong object
 * the two barrel kinds are. Nothing here claims one — the kinds are the downstream
 * stampReleasedBarrelKind's business and are described only as observed behaviour there.
 *
 * NAME: kept loc_ — an English name is earned in an understanding pass, not here.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2cb8.test.js.
 * GATE:     real captured 0x2CB8 dispatches from a plain attract run — MEASURED 55 in 14000
 *           frames, covering 8 of the 10 slot indices (the scan's countdown took 3..10) and
 *           BONUS 50 down to 37 — PLUS crafted entries built from a real capture by poking one
 *           byte identically on both sides: every slot index 0..9 (attract never reaches the two
 *           lowest), an exhaustive 256-value sweep of the countdown that pins the slot
 *           arithmetic over its whole byte range, and an exhaustive 256-value sweep of BONUS
 *           that reaches the bonus-expiry arm attract never does (the counter never fell below
 *           37 in 14000 frames). One crafted case drives the continuation through the
 *           renderer's acting frame instead of its frame-gate return. The RAM diff excludes the
 *           dead STACK_SCRATCH churned by the oracle's dissolved call brackets (its own
 *           `call 0x309F` and the downstream chain's `call 0x004E`); pc + SP are compared after
 *           one modelled terminal return. Teeth: five broken twins — wrong slot index, wrong
 *           claim value, dropped bonus-expiry latch, dropped task post, dropped continuation.
 *           OBSERVED FAILING against THIS file, not only against the twins: an off-by-one in the
 *           slot index failed three of the five cases (`RAM@0x62ac oracle=128 cand=124`) and
 *           dropping the expiry latch failed the BONUS sweep (`bonus 1: RAM@0x6386 oracle=1
 *           cand=0`) — the crafted arm exists precisely because attract never reaches it.
 * LIVE-OUT: memory-only, plus the control-flow boundary. This routine pushes nothing of its
 *           own — its exit is a jump into loc_2ce6 — and the chain
 *           loc_2ce6 -> stampReleasedBarrelKind -> advanceBarrelRelease nets exactly ONE caller-return pop,
 *           performed downstream on this routine's behalf; the idiomatic form models that as a
 *           plain JS return and the gate performs the single m.ret(). No register is live-out:
 *           the callers of the scan above read none of them, and every register the oracle
 *           leaves behind (the scaled index, the computed pointers, the accumulator) is
 *           overwritten downstream before it is read.
 * NAMES:    RENDER_OBJ_PTR (0x62AA), RENDER_DST_PTR (0x62AC), ACTOR_SPRITES (0x6980),
 *           BONUS (0x62B1), BONUS_EXPIRED_STEP (0x6386) and the record field OBJ_ACTIVE (+0),
 *           all imported from names.js.
 *           ★ OFFSET NAMESPACE: the index register points at an OBJECT record (an OBJ_ARRAY_67
 *           barrel record, grounded 46/46), so its +0 is the object-record OBJ_ACTIVE — NOT the
 *           sprite-record SPRITE_X that shares the numeric offset 0, and not the OBJ_PAIR_6680-
 *           scoped HAMMER_IN_PLAY. The destination the routine COMPUTES is in the other
 *           namespace: ACTOR_SPRITES is a group of hardware sprite records inside SPRITE_BUFFER,
 *           so the stride that scales the index is the 4-byte sprite-record stride, not the
 *           0x20-byte object-record stride the scan above uses.
 *           The event gate 0x6393 is UNNAMED in names.js — examined and rejected as shared 0x63xx
 *           engine scratch — so it stays a local hex const, the same convention as the siblings
 *           scheduleBarrelRelease and activateReleasedBarrel that read and clear it.
 */

import { u8 } from "../../../core/int.js";
import {
  RENDER_OBJ_PTR, RENDER_DST_PTR, ACTOR_SPRITES, OBJ_ACTIVE, BONUS, BONUS_EXPIRED_STEP,
} from "./names.js";
import { enqueueTask } from "./enqueueTask.js"; // ROM 0x309F — post a deferred [opcode, argument]
import { loc_2ce6 } from "./loc_2ce6.js"; // ROM 0x2CE6 — the rest of the cluster chain

const EVENT_GATE = 0x6393; // bit0 SET -> a release happened this pass (unnamed, rejected-as-shared 0x63xx scratch)
const SLOT_CLAIMED = 2; // OBJ_ACTIVE bit 1 = occupied; the movement code replaces it with 1 (active)
const BARREL_SLOTS = 10; // records in OBJ_ARRAY_67, and slots in ACTOR_SPRITES
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
  enqueueTask(m); // ROM 0x309F

  // Then the counter itself: on 25m releasing a barrel IS the bonus tick. Hitting zero starts
  // the bonus-expired sequence.
  const remaining = u8(mem.read8(BONUS) - 1);
  mem.write8(BONUS, remaining);
  if (remaining === 0) mem.write8(BONUS_EXPIRED_STEP, 1);

  // Continue into the rest of the chain. loc_2ce6 reads the counter through the caller's pointer
  // register, so hand it the counter's address — it sees the post-charge count.
  regs.hl = BONUS;
  return loc_2ce6(m);
}
