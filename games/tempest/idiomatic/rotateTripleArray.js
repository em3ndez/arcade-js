// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { COLOR_CYCLE_0, COLOR_RAM_9 } from "./names.js";

/**
 * rotateTripleArray -- cyclically rotate a three-entry colour array down one slot and mirror it to
 * colour RAM. ROM 0xb875.
 *
 * Role in the machine: Tempest animates parts of the display by cycling a tiny palette. This routine
 * rotates the three-entry working array at COLOR_CYCLE_0..COLOR_CYCLE_2 ($22-$24) by one position each
 * time it is called and copies every rotated value straight into the paired colour-RAM run at
 * COLOR_RAM_9..COLOR_RAM_B ($809-$80b). Called frame over frame, the effect is a smooth colour march
 * across the three cells.
 *
 * Behavior: capture the first entry ($22) as the value that will wrap around, then walk the array from
 * the top index (x = 2) down to 0. At each step it saves the current occupant, drops the carried value
 * into that slot AND its colour-RAM mirror, and promotes the saved occupant to be carried into the next
 * lower slot. Because the loop runs high-to-low while the seed came from the low end, the net motion is a
 * rotate-down: $24<-$23, $23<-$22, $22<-(old $22 that was pre-saved as carry).
 *
 * Live-out: the rotated working array COLOR_CYCLE_0..2 and, byte-for-byte identical, the visible colour
 * cells COLOR_RAM_9..B. Grounding: [code].
 */
export function rotateTripleArray(m) {
  const { mem8 } = m;
  let carry = mem8[COLOR_CYCLE_0];              // the entry that wraps around
  for (let x = 2; x >= 0; x--) {
    const old = mem8[u16(COLOR_CYCLE_0 + x)]; // remember who is here before overwriting
    mem8[u16(COLOR_CYCLE_0 + x)] = carry;    // shift the carried value into this working slot
    mem8[u16(COLOR_RAM_9 + x)] = carry;     // mirror the new value into visible colour RAM
    carry = old;                            // the displaced occupant carries down to the next slot
  }
}
