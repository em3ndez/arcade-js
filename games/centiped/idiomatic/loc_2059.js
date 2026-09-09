// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  loc_00, loc_40, loc_43, loc_60, loc_70, loc_80, loc_88, loc_8b,
  loc_9a, loc_ab, loc_d7, loc_ef, loc_f0,
} from "./names.js";
import { stampGridCellAtObject } from "./stampGridCellAtObject.js";

/**
 * loc_2059 — the gated per-object state step that feeds the mushroom-stamping path (ROM 0x2059).
 * Each enabled frame it decides whether the steered object may advance and, if so, cycles its
 * attribute, steps its coordinate, and tail-dispatches into the grid-stamp gate that lays a mushroom
 * under the object.
 *
 * The object may advance only when it is in a live movement state AND its screen position is inside
 * the playable band: the $43 control bits must be clear, and the object's orientation-folded X offset
 * ($40 ^ $ef) and Y offset ($70 ^ $f0) must both fall inside their limits. The `^ $ef` / `^ $f0`
 * folds are the flip-cabinet mirror masks, so one body of code handles the upright and inverted
 * orientation without a second copy. Near the very top edge an extra per-slot distance test against
 * the $9a/$ab/$d7 arrays gates the advance so objects do not pile up at the ceiling.
 *
 * Role: playfield grid / per-object advance feeding stampGridCellAtObject.  Grounding: [code].
 * Live-out: $40, $8b, and the stamp gate's result (or an early RTS on any failed gate).
 */
export function loc_2059(m) {
  const { mem8 } = m;
  // Mode gate: any $43 control bit (& 0xaf) set inhibits the object step -> bail (RTS).
  if ((mem8[loc_43] & 0xaf) !== 0) return;
  // Horizontal band: the mirror-folded X offset must stay under 32 columns from the origin, else the
  // object is off the playable strip and does not advance this frame.
  if (u8(mem8[loc_40] ^ mem8[loc_ef]) >= 32) return;
  // Fold the Y coordinate through the orientation mask; values >= 248 are the wrapped "near the top
  // edge" region (i.e. a small negative offset), which needs the extra per-slot ceiling test below.
  const yFold = u8(mem8[loc_70] ^ mem8[loc_f0]);
  if (yFold >= 248) {
    // Near the top edge: run the per-slot distance bounds before advancing.
    const x = mem8[loc_88];
    // $9a[x] is a per-slot length/age counter; a value >= 12 means this slot has already run its
    // course near the top, so hold it back rather than push it off the ceiling.
    if (mem8[u8(loc_9a + x)] >= 12) return;
    // Pick a distance bound from the per-slot selector $ab[x]: baseline 9 (or 5 when the selector is
    // below 2), widened to (sel>>1)+6 for large selectors so faster/older slots get more headroom.
    const sel = mem8[u8(loc_ab + x)];
    let bound = sel >= 2 ? 9 : 5;
    if (sel >= 18) bound = u8((sel >> 1) + 6);
    // Compare the bound against the per-column mushroom tally $d7[x]: if the column is already fuller
    // than the bound allows, the object is not permitted to advance into it this frame.
    if (bound < mem8[u8(loc_d7 + x)]) return;
  }
  // Advance the $40 attribute once every 4th frame.
  if ((mem8[loc_00] & 0x03) === 0) {
    // Two-step cycle of the attribute byte: bump it, then re-fold the low two bits back on with the
    // fixed 0x1c bits set and the orientation mask applied — this animates the object's tile/colour
    // attribute through a small repeating cycle while keeping the mirror orientation correct.
    mem8[loc_40] = u8(mem8[loc_40] + 1);
    mem8[loc_40] = (((u8(mem8[loc_40] + 1) & 0x03) | 0x1c)) ^ mem8[loc_ef];
  }
  // Publish the running velocity $60 into the scratch $8b that the stamp gate reads.
  mem8[loc_8b] = mem8[loc_60];
  // Step the object's coordinate $70 by its speed $80; $ef selects the direction (subtract vs add) so
  // the object walks the correct way for the current cabinet orientation.
  const stepped = mem8[loc_ef] === 0
    ? u8(mem8[loc_70] - mem8[loc_80])
    : u8(mem8[loc_70] + mem8[loc_80]);
  // Tail-dispatch the stamp gate with the stepped value.
  return stampGridCellAtObject(m, stepped);
}
