// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { OBJECT_INDEX_TABLE, OBJECT_RECORD_TABLE, FIRE_GATE, POKEY1_RANDOM } from "./names.js";

/**
 * seedSlotRandomTags — give every active climber slot a fresh random tag. ROM 0x9246.
 *
 * Role in the machine: each climber (the enemies that crawl up the tube lanes) occupies a
 * numbered slot, and the game tags each live slot with a random nibble so identical enemies
 * animate and behave out of phase with one another. This routine wipes the tag table and
 * re-seeds it for exactly the slots that are currently active, using the POKEY hardware RNG
 * so the pattern differs every wave.
 *
 * Behavior: first clear the whole 64-byte tag/record table $243..$243+0x3f. Then walk the
 * active slots from $3ab-1 (the header/active count set by seedPerLaneSpikeArray) down to 0:
 * for each slot X take a 4-bit POKEY random ($60ca & 0x0f), store that nibble in the per-slot
 * index cell $203,X, and pack the slot index with the nibble into the record byte
 * $243,X = (X<<4) | nibble; if that packed value would be zero it is stored as 0x0f instead
 * so a live slot never carries an all-zero tag. The loop ends when X decrements past 0
 * (the 0x80 sign bit appears).
 *
 * Live-out: the tag/record table $243..$282 (cleared, then live slots tagged) and the
 * per-slot index cells $203,X for each active slot. Grounding: [seen].
 */
export function seedSlotRandomTags(m) {
  const { mem8 } = m;
  // Clear the full 64-byte tag/record table so stale slots carry no tag.
  for (let x = 0x3f; x >= 0; x--) mem8[u16(OBJECT_RECORD_TABLE + x)] = 0;
  let x = u8(mem8[FIRE_GATE] - 1); // start at the top active slot (header count - 1)
  do {
    const rand = mem8[POKEY1_RANDOM] & 0x0f; // 4-bit POKEY random for this slot
    mem8[u16(OBJECT_INDEX_TABLE + x)] = rand; // stash the nibble in the per-slot index cell
    const tag = u8(x << 4) | rand;            // pack slot index (hi nibble) with random (lo)
    mem8[u16(OBJECT_RECORD_TABLE + x)] = tag === 0 ? 0x0f : tag; // avoid an all-zero live tag
    x = u8(x - 1);
  } while (!(x & 0x80)); // stop once X underflows past 0 (sign bit set)
}
