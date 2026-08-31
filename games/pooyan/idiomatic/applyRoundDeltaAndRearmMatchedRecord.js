// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { storeActorAnimationPointer } from "./storeActorAnimationPointer.js";
import { loc_6274 } from "./loc_6274.js";
import { ROUND_COUNTER, POSITION_DELTA_TABLE_6360, ANIM_SCRIPT_634F } from "./names.js";
/**
 * applyRoundDeltaAndRearmMatchedRecord — re-locate an enemy record by its collision tag,
 * nudge its position by the current round's delta, re-arm it, and retire the spent
 * hunter-target slot.
 *
 * WHAT IT IS
 * ----------
 * The tail of the enemy re-launch path. Each on-screen enemy owns a 0x18-byte record,
 * and the six live enemy records sit one 0x18 stride apart from the base of the
 * enemy-actor pool. Within a record, +0x14 is the collision tag (the key a projectile
 * hit is matched against), +0x0a is a signed position field, +0x16 is a flag byte, and
 * +0x0c/+0x0d/+0x0e describe which animation the enemy is playing.
 *
 * When the proximity/hit test upstream decides an enemy must be re-launched on a new
 * trajectory, control arrives here carrying that enemy's collision tag in `tag`. This
 * routine finds the record holding that tag and then does four things to it:
 *   1. adds a signed, per-round position delta into the record's +0x0a field,
 *   2. sets the re-arm marker (bit 5 of the +0x16 flag byte),
 *   3. points the record at animation script 0x634f and rewinds it to its first step, and
 *   4. clears the currently-selected hunter-target record and stops the frame.
 *
 * ROLE IN THE MACHINE
 * -------------------
 * This closes out one enemy's hit response. The round-indexed delta shifts the enemy's
 * +0x0a position by an amount that changes with the round (a per-round difficulty ramp),
 * while the re-arm bit and the fresh animation-script pointer put the record back into an
 * active, playing state so the enemy re-enters the normal motion passes next frame. The
 * final step hands off to the paired-record clear, which frees the hunter-target slot the
 * launch arrow had reserved and aborts the remainder of this frame's collision work.
 *
 * ROM 0x62e6-0x630e.
 *
 * Grounding: [seen].
 *
 * LIVE-OUT: memory — on the settled record, +0x0a (bumped by the round delta), +0x16
 * (bit 5 set), +0x0c/+0x0d (animation-script pointer) and +0x0e (step index reset to 0),
 * plus whatever the paired-record clear writes. The return value is the abort signal
 * (always false): the caller drops its remaining work and this frame's hit-resolution
 * unwinds.
 */

const TAG_OFFSET = 0x14;   // record +0x14: the collision tag that matches a hit to its enemy
const DELTA_FIELD = 0x0a;  // record +0x0a: the signed position field the round delta lands in
const FLAG_FIELD = 0x16;   // record +0x16: the enemy record's flag byte
const REARM_BIT = 0x20; // bit 5 of the flag byte: the re-arm marker

export function applyRoundDeltaAndRearmMatchedRecord(m, tag = m.regs.a, record = m.regs.iy, count = m.regs.c, stride = m.regs.de) {
  const { mem8 } = m;

  // --- Locate the record by its collision tag --------------------------------
  // Walk up to `count` records, each `stride` (0x18) bytes apart, starting from the pool
  // base in `record`. Compare each record's +0x14 tag against the wanted tag and stop on
  // the first match: this turns a collision key back into the specific enemy record that
  // owns it. If the pool drains with no match, `rec` is left on the record one step past
  // the last one checked and the apply below runs against that fallback.
  let rec = record;
  let remaining = count;
  for (;;) {
    if (mem8[rec + TAG_OFFSET] === tag) break; // tag hit: `rec` is the record to re-arm
    rec = u16(rec + stride);                   // advance to the next record in the pool
    remaining = (remaining - 1) & 0xff;        // one fewer record left to try
    if (remaining === 0) break; // pool exhausted with no match -> apply to the last stepped record
  }

  // --- Apply the current round's position delta ------------------------------
  // Pick the delta-table slot from the round counter (ROUND_COUNTER @0x8907):
  // index = (round & 7) >> 1, so it holds for two rounds at a time and repeats every
  // eight rounds. The signed delta byte is read from POSITION_DELTA_TABLE_6360 (ROM
  // 0x6360) at that index.
  const index = (mem8[ROUND_COUNTER] & 0x07) >> 1;
  const [delta] = fetchByteFromTableIndex(m, POSITION_DELTA_TABLE_6360, index);
  // Add the signed delta into the record's +0x0a position field. The field is a single
  // byte, so the sum wraps within 8 bits — this is the per-round shift applied to the
  // re-launched enemy.
  mem8[rec + DELTA_FIELD] = (mem8[rec + DELTA_FIELD] + delta);

  // --- Re-arm the record -----------------------------------------------------
  // Set bit 5 of the +0x16 flag byte. This re-arm marker flags the record as freshly
  // re-launched so the enemy-update passes treat it as live again.
  mem8[rec + FLAG_FIELD] = mem8[rec + FLAG_FIELD] | REARM_BIT;
  // Install animation script 0x634f (ANIM_SCRIPT_634F): its low/high bytes go to
  // +0x0c/+0x0d and the step index at +0x0e is reset to 0, so the enemy starts the new
  // animation from its first frame.
  storeActorAnimationPointer(m, rec, ANIM_SCRIPT_634F);

  // --- Retire the hunter-target slot and stop the frame ----------------------
  // Hand off to the paired-record clear: it wipes whichever of the two interrupt-parity
  // hunter-target records is currently selected (freeing the slot the launch arrow had
  // reserved) and reports the abort. Returning that result — always false — makes the
  // caller abandon its remaining collision work and unwinds this frame's hit-resolution
  // path one extra level, matching the machine's skip-return.
  return loc_6274(m); // paired-record clear -> abort (always false)
}
