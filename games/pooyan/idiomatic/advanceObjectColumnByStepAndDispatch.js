// SPDX-License-Identifier: GPL-3.0-only
import { despawnActorAndRenderStageCountdown } from "./despawnActorAndRenderStageCountdown.js";
import { armInteriorBandOrMarkActorActive } from "./armInteriorBandOrMarkActorActive.js";
import { TURN_COLUMN_LIMIT, PLAY_STATE_INDEX } from "./names.js";
/**
 * advanceObjectColumnByStepAndDispatch — step one moving object along its column axis, then act on where it landed.
 *
 * WHAT IT IS
 *   The shared per-object movement handler for the enemy / formation objects that
 *   travel across the arena on a fixed track. Each such object owns a record
 *   addressed by IX; this routine advances that one object by a single tick of
 *   motion and then decides — purely from the tile-column it now occupies — whether
 *   the object keeps travelling, has reached its turn point, or has run all the way
 *   to the end of its track.
 *
 * ROLE IN THE MACHINE
 *   Run once per object per frame while the object is in its "walking" state.
 *   Motion is stored as a fixed-point descent: the object's whole tile-column
 *   counts DOWN toward the turn-column limit and, ultimately, toward column zero.
 *   The routine never moves the column upward — each tick either holds the column
 *   or borrows it down by one — so an object marches monotonically inward until it
 *   either turns (arming its interior sprite band) or is removed from play. The
 *   X-axis sibling, advanceActorColumnAndArmTurnOrBand, does the same job for the
 *   other travel direction.
 *
 * THE OBJECT RECORD (fields read / written, all relative to IX)
 *   +0x05  sub-position  — the fractional (within-column) part of the position
 *   +0x06  column byte   — the whole tile-column; only its low five bits address a column
 *   +0x08  record latch  — this object's "armed" flag; cleared to disarm the object
 *   +0x09  aim field     — a target the sub-position must reach before the turn arms
 *   +0x0a  signed step   — the per-tick velocity added to the sub-position
 *
 * WHAT IT DECIDES (the masked column compared against the shared TURN_COLUMN_LIMIT at 0x8d4b)
 *   column  > limit : still short of the turn point — keep travelling, do nothing.
 *   column == limit : at the turn point — during in-play sub-state 4, and once the
 *                     aim field has caught up to the new sub-position, arm the
 *                     interior sprite band (the object's turn / entry).
 *   column  < limit : past the turn point — during in-play sub-state 4, disarm the
 *                     object's record latch (+0x08).
 *   column == 0     : end of the track — hand off to the despawn tail, which blanks
 *                     the sprite band, drops the active-object counters, and renders
 *                     the stage countdown. Column zero is checked in both the "==" and
 *                     "<" branches, so it always despawns whatever value the limit holds.
 *
 * Grounding: [seen]
 * ROM: 0x34f2-0x3535
 * LIVE-OUT: none — its caller reloads A on return and reads no register back.
 */
const COLUMN_MASK = 0x1f;
const PLAY_STATE_FOURTH = 0x04;

export function advanceObjectColumnByStepAndDispatch(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // --- Advance the fixed-point position by one tick of velocity -----------------
  // The object's position is a two-part value: +0x06 is the whole tile-column and
  // +0x05 is the fractional sub-position within it. Each tick adds the signed step
  // (+0x0a) — the object's velocity — to the sub-position. The column is only ever
  // borrowed DOWNWARD: when the current sub-position lies below the negated step,
  // adding the step wraps the sub-position past the bottom of the column, so the
  // object has crossed into the next column and the column byte is decremented by
  // one. That is why an object marches steadily inward, its column counting down.
  const step = mem8[ix + 0x0a];
  const pos = mem8[ix + 0x05];
  if (pos < ((-step) & 0xff)) mem8[ix + 0x06] = mem8[ix + 0x06] - 1; // borrow into the column (byte wraps)
  const newPos = (pos + step) & 0xff;
  mem8[ix + 0x05] = newPos;

  // --- Read where the object now sits, and the shared turn threshold ------------
  // Only the low five bits of the column byte address a tile-column (0..31); any
  // upper bits are flags riding alongside it, so they are masked off here.
  // TURN_COLUMN_LIMIT (0x8d4b) is the per-wave threshold at which a travelling
  // object begins its turn; the anim-arm routines seed it to 0 or 0xff to open or
  // close the turn for a whole wave at once.
  const column = mem8[ix + 0x06] & COLUMN_MASK;
  const limit = mem8[TURN_COLUMN_LIMIT];

  if (column === limit) {
    // Sitting exactly on the turn column. If that column is zero the object has
    // reached the end of its track (this arises when the limit itself is zero):
    // hand off to the despawn tail.
    if (column === 0) return despawnActorAndRenderStageCountdown(m, ix);
    // The turn only arms during active play — in-play sub-state 4 (PLAY_STATE_INDEX
    // at 0x880a). In any other phase the object simply holds on the turn column.
    if (mem8[PLAY_STATE_INDEX] !== PLAY_STATE_FOURTH) return;
    // Hold the turn off until the aim field (+0x09) has caught up to the freshly
    // written sub-position; the object must close that gap before it may turn.
    if (mem8[ix + 0x09] < newPos) return; // aim not yet caught up to the new sub-position
    // Aim satisfied: arm the interior sprite band (the object's turn / entry).
    return armInteriorBandOrMarkActorActive(m, ix);
  }

  // Column is not the turn column. If it is still above the threshold the object
  // has not reached its turn point yet — keep travelling, nothing to do this tick.
  if (column > limit) return; // still above the turn column
  // Below the threshold now (past the turn point). Column zero is the end of the
  // track — despawn, exactly as in the equal branch above.
  if (column === 0) return despawnActorAndRenderStageCountdown(m, ix);
  // Otherwise, and only during active play (sub-state 4), disarm this object's
  // record latch (+0x08) so it is no longer treated as armed on later ticks.
  if (mem8[PLAY_STATE_INDEX] !== PLAY_STATE_FOURTH) return;
  mem8[ix + 0x08] = 0x00; // disarm the record
}
