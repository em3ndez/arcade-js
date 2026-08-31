// SPDX-License-Identifier: GPL-3.0-only
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { ROUND_COUNTER, DIFFICULTY_DSW, STAGE_COUNTDOWN, ACTOR_ATTR_BASE_TABLE, ACTOR_ATTR_MERGE_TABLE } from "./names.js";
/**
 * mergeActorAttributeByte — build an actor's attribute byte (record +0x08) from two lookup tables.
 *
 * WHAT IT IS
 * ----------
 * A small "pick the right attribute for this actor, right now" routine that lives at ROM
 * 0x36de-0x3726. Grounding: [seen]. When an object is being spawned into the actor world it needs
 * an attribute byte stamped into its record at offset +0x08. That byte is not a fixed constant: it
 * is chosen from two ROM tables so that it scales with how hard the game currently is (difficulty
 * switch setting and how far the player has progressed), nudged by a couple of per-record flags,
 * and pushed to a different value in the closing moments of a stage.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * The spawn path (spawnObjectIntoFreeSlot) lays down the fixed fields of a new actor's template
 * record and then calls here to fill in +0x08. So this routine is one step of object birth: by the
 * time it runs, the template already holds the flag/phase fields this routine reads, and the value
 * it computes selects the actor's attribute for the whole life of that record.
 *
 * HOW THE VALUE IS BUILT (four stages)
 * ------------------------------------
 *   1. Seed. Look up a base value in ACTOR_ATTR_BASE_TABLE (ROM 0x3737), indexed by
 *      2*difficulty + round (the round clamped to 0x0e). Harder settings and later rounds land on
 *      a different, generally larger seed.
 *   2. Flag step-down. If the record's +0x16 "armed" bit is set, step the value down one; if that
 *      did not reach zero and the record's +0x13 phase bit is also set, step it down once more.
 *      Reaching zero here stops all further stepping.
 *   3. Phase step-down. If the value did not zero out and the record's +0x06 phase field is below
 *      9, step the value down once, and once more if the first step did not reach zero.
 *   4. Stage-end bias. If the per-stage countdown (STAGE_COUNTDOWN) is below 4 — the last handful
 *      of ticks of a stage — add 3 to the value, shifting the final lookup into a different region.
 *   Finally the adjusted value indexes ACTOR_ATTR_MERGE_TABLE (ROM 0x3727) and that byte is OR-ed
 *   into the record's existing +0x08, setting bits without disturbing bits already there.
 *
 * LIVE-OUT: memory only — the +0x08 byte; the tail successor discards A/B/HL and C is untouched.
 */
export function mergeActorAttributeByte(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // --- Stage 1: seed from ACTOR_ATTR_BASE_TABLE (ROM 0x3737) ---
  // Form the row index from how far the game has progressed and how hard it is set. ROUND_COUNTER
  // (0x8907) is the HUD round number; clamp it to 0x0e so a very high round still indexes a valid
  // table row. DIFFICULTY_DSW (0x8820) is the 3-bit difficulty decoded from the DIP switches;
  // doubling it interleaves two table rows per difficulty step, and adding the clamped round walks
  // along that difficulty's run. fetchByteFromTableIndex is the machine's byte-table fetch at ROM
  // 0x0020 (the restart vector): it returns the byte at base+index, our starting attribute value.
  const round = mem8[ROUND_COUNTER];
  const clampedRound = round < 0x10 ? round : 0x0e;
  const index = (mem8[DIFFICULTY_DSW] * 2 + clampedRound) & 0xff;
  let value = fetchByteFromTableIndex(m, ACTOR_ATTR_BASE_TABLE, index)[0];

  // --- Stage 2: step the value down past the record's grow/shrink flags (+0x16, +0x13) ---
  // +0x16 is the record's "armed" bit and +0x13 its phase bit (the pair the grow/shrink hold
  // stepper writes). Each armed bit peels one off the seed, so a record mid-animation resolves to a
  // lower attribute. `zeroed` remembers whether the value hit zero here: once the value bottoms out
  // there is nothing left to step, and the phase step-down below is skipped entirely.
  let zeroed = false;
  if ((mem8[rec + 0x16] & 1) !== 0) {
    value = (value - 1) & 0xff;
    if (value === 0) zeroed = true;
    else if ((mem8[rec + 0x13] & 1) !== 0) {
      value = (value - 1) & 0xff;
      if (value === 0) zeroed = true;
    }
  }

  // --- Stage 3: step the value down for an early-phase record (+0x06 below 9) ---
  // Only if the value survived stage 2 without reaching zero. The record's +0x06 phase field being
  // below 9 marks an actor still early in its progression; such a record gets one step off the
  // value, plus a second step when the first did not land on zero (a record already stepped to
  // exactly 1 takes only the single step).
  if (!zeroed && mem8[rec + 0x06] < 0x09) {
    value = (value - 1) & 0xff;
    if (value !== 0) value = (value - 1) & 0xff;
  }

  // --- Stage 4: bias the value up by 3 in the last ticks of a stage ---
  // STAGE_COUNTDOWN (0x8901) drains across a stage; once it drops below 4 the stage is nearly over.
  // Adding 3 here shifts the merge-table lookup below into a different band, giving late-stage
  // spawns a distinct attribute. This bias applies regardless of whether the value was zeroed above.
  if (mem8[STAGE_COUNTDOWN] < 0x04) value = (value + 0x03) & 0xff;

  // --- Merge: index ACTOR_ATTR_MERGE_TABLE (ROM 0x3727) and OR the result into +0x08 ---
  // The finished value picks a byte from the merge table (again via the ROM 0x0020 fetch), which is
  // OR-ed onto whatever the record already holds at +0x08 — the new bits are laid over the existing
  // attribute rather than replacing it, so previously stamped bits are preserved.
  mem8[rec + 0x08] = fetchByteFromTableIndex(m, ACTOR_ATTR_MERGE_TABLE, value)[0] | mem8[rec + 0x08];
}
