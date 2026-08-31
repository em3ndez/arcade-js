// SPDX-License-Identifier: GPL-3.0-only
import { loc_60f2 } from "./loc_60f2.js";
import { resolveOddRoundCollisionAndAward } from "./resolveOddRoundCollisionAndAward.js";
import { gateEvenRoundOverlapAndRouteHit } from "./gateEvenRoundOverlapAndRouteHit.js";
import { ROUND_COUNTER } from "./names.js";
/**
 * classifyAndRouteObjectRecordByRound — scan head: classify the record under the cursor and route it.
 *
 * WHAT IT IS
 * ----------
 * The loop body of one of Pooyan's per-frame object-proximity collision sweeps. Every collidable
 * thing in the game lives in a fixed-layout record in work RAM; a sweep walks a run of those
 * records and, for each live one, tests whether a shot has overlapped it. This routine is the head
 * of that walk: it is re-entered once per record with the cursor already pointing at the current
 * record, decides whether the record is worth scanning at all, and — if it is — hands it to the
 * matching collision test. Records that are empty or of the wrong kind are dropped straight to the
 * loop epilogue, which steps the cursor to the next record and comes back here.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * The scan is armed one level up: the per-slot object-proximity scan resolveObjectProximityHitsBothSlots
 * runs once per collision slot, and its per-slot body seats the record cursor on the five-slot
 * secondary object pool (HL = SPRITE_OBJECT_TABLE, 0x8b70) with the pass count B = 5 and the sprite
 * cursor IX on the display list, then falls into this head. Each visit here does three things in
 * order:
 *   1. drop empty records (a free slot has byte 0 == 0),
 *   2. drop records that are not the live/scannable KIND (the record's byte +2 must equal 0x05),
 *   3. for a live record, split on the round's parity — an odd round runs the actor-collision
 *      handler (resolveOddRoundCollisionAndAward), an even round runs the proximity gate (gateEvenRoundOverlapAndRouteHit).
 * The pointer trio (HL record cursor, IX sprite cursor, B remaining count) plus the two-player /
 * interrupt-parity registers (IY, I) are threaded through unchanged to whichever route is taken, so
 * the loop epilogue can keep walking the run.
 *
 * ROM: 0x6069 (0x6069-0x607f). The loop head — reached by fall-through from the per-slot body and,
 * once the epilogue has stepped the cursor, by the epilogue's loop-back branch.
 * Grounding: this routine carries no standalone cert of its own; it is reached only from the [seen]
 * resolveObjectProximityHitsBothSlots, and the state it reads — the [seen] SPRITE_OBJECT_TABLE
 * records it walks and the [seen] ROUND_COUNTER — is grounded.
 *
 * INPUTS
 * ------
 *   hl    — the record cursor: the base of the record to classify this pass.
 *   ix    — the sprite display-list cursor paired with the record, forwarded to the collision test.
 *   count — records left to sweep (the loop's B); forwarded so the epilogue can decrement it.
 *   iy    — the target/collision-slot record pointer the test measures the record against.
 *   ireg  — the interrupt vector register; its parity picks which collision slot the pass owns.
 *
 * LIVE-OUT: a boolean forwarded straight from the route taken, read by the master actor updater as
 * continue-vs-abort — true lets the per-frame update carry on (a clean pass, or the loop draining to
 * its end via the epilogue), false means a hit fired and the caller must unwind its frame.
 */
// A record's KIND byte lives at record+0x02; only KIND 0x05 records are live/scannable (an empty
// slot has byte 0 == 0, and any other KIND is skipped the same way an empty slot is).
const LIVE_KIND = 0x05;
const KIND_OFFSET = 0x02;

export function classifyAndRouteObjectRecordByRound(m, hl = m.regs.hl, ix = m.regs.ix, count = m.regs.b, iy = m.regs.iy, ireg = m.regs.i) {
  const { mem8 } = m;
  // Step 1 — drop empty slots. Byte 0 of a record is its active flag; a zero there is a free slot
  // with nothing to collide, so route the record straight to the loop epilogue (loc_60f2), which
  // advances the cursors, decrements the count, and re-enters this head for the next record.
  if (mem8[hl] === 0) return loc_60f2(m, hl, ix, count, iy, ireg); // empty record
  // Step 2 — read the record's KIND byte at record+0x02. The low byte is wrapped inside the
  // record's 256-byte page (high byte held, low byte = (L+2) mod 256): the original walk stepped
  // the low pointer register on its own, so a +2 offset stays page-local and never carries into the
  // high byte. This preserves that page-wrap addressing exactly.
  const kind = mem8[(hl & ~0xff) | ((hl + KIND_OFFSET) & 0xff)];
  // A record whose KIND is not the live 0x05 value is not part of this scan — skip it to the
  // epilogue exactly as an empty slot is skipped.
  if (kind !== LIVE_KIND) return loc_60f2(m, hl, ix, count, iy, ireg);
  // Step 3 — a live type-0x05 record: split on the round parity read from ROUND_COUNTER (0x8907).
  // On an odd round the record is handed to the actor-collision handler (resolveOddRoundCollisionAndAward); on an even
  // round it goes to the proximity gate (gateEvenRoundOverlapAndRouteHit). Both routes carry the same pointer/parity
  // registers so the sweep can resume, and both return the continue/abort boolean forwarded above.
  if (mem8[ROUND_COUNTER] & 0x01) return resolveOddRoundCollisionAndAward(m, hl, ix, count, iy, ireg); // odd round
  return gateEvenRoundOverlapAndRouteHit(m, hl, ix, count, iy, ireg);
}
