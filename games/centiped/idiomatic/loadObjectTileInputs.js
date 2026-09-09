// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { loc_44, loc_54, loc_64, loc_8b } from "./names.js";

/**
 * loadObjectTileInputs — marshal one object slot's position and heading for the tile-cell probe.
 *
 * Objects in Centipede (spiders, fleas, the player shot, etc.) are stored in parallel
 * per-slot zero-page arrays indexed by the slot number X:
 *   - loc_54+X — the slot's base byte (a coordinate/state field);
 *   - loc_44+X — the slot's heading byte (its sign bit encodes the direction of travel);
 *   - loc_64+X — the slot's coordinate byte the tile probe actually tests.
 * Callers such as the mushroom-stamping path need these three values packaged before they
 * can resolve which grid cell an object is standing on. This routine is that small
 * marshaller — a leaf with no sub-calls: one store plus two register outputs.
 *
 * It (1) copies the base byte into scratch cell loc_8b ($8b), (2) turns the heading's sign
 * into a ±1 tile step (0xff == step "left/up" when the sign bit is set, else 0x01), and
 * (3) loads the probe coordinate into A. u8() keeps the base+index address wrapped to 8 bits,
 * matching the 6502 zero-page indexing so a slot near the top of the page still aliases exactly.
 *
 * ROM 0x… . Grounding: [code] — read from behaviour; the underlying cells are bare zero-page
 * placeholders. Live-out: scratch $8b holds the base byte; Y = the ±1 step; A = the coordinate byte.
 */
export function loadObjectTileInputs(m, x = m.regs.x) {
  const { mem8, regs } = m;
  // Snapshot the slot's base byte into scratch $8b BEFORE anything else. Ordering matters:
  // if this very slot's base cell happens to be $8b itself, reading first then storing keeps
  // the alias exact (the original 6502 did lda then sta in this order).
  // Read the base byte before storing, so a slot whose base cell is $8b still aliases exactly.
  mem8[loc_8b] = mem8[u8(loc_54 + x)];
  // Derive the ±1 tile step from the heading's sign bit: 0x80 set means "negative"
  // direction (step 0xff, i.e. -1); otherwise step +1 (0x01).
  // step = 0xff when the heading's sign bit is set, else 0x01.
  const step = mem8[u8(loc_44 + x)] & 0x80 ? 0xff : 0x01;
  // Publish both register outputs at once: Y = the ±1 step, A = the slot's probe coordinate.
  // Publish both register outputs: Y = the step, A = the slot's coordinate byte.
  return [(regs.y = step), (regs.a = mem8[u8(loc_64 + x)])];
}
