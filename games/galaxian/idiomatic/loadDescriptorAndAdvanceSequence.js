// SPDX-License-Identifier: GPL-3.0-only
// Sequence-state handler: unpack a descriptor's flag bitmask into the flag block and copy the 8-byte
// template that follows it into the template buffer, clear/set two status bytes, advance the sequence
// state, stamp a counter, and publish a deferred-callback pointer.
import { unpackBitmaskToFlagBytes } from "./unpackBitmaskToFlagBytes.js";
import {
  loc_051b,
  loc_4218,
  loc_425f,
  loc_421d,
  SEQUENCE_STATE,
  VRAM_WRITE_PTR,
  loc_4245,
  loc_0640,
} from "./names.js";

const TEMPLATE_BYTES = 8;

export function loadDescriptorAndAdvanceSequence(m) {
  const { mem8, mem16 } = m;

  // Unpack the descriptor bitmask into the flag block; the returned pointer sits on the template.
  const template = unpackBitmaskToFlagBytes(m, loc_051b);
  for (let i = 0; i < TEMPLATE_BYTES; i++) mem8[loc_4218 + i] = mem8[template + i];

  mem8[loc_425f] = 0;
  mem8[loc_421d] = 1;
  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1;
  mem8[VRAM_WRITE_PTR] = 150; // stamp the counter cell
  mem16[loc_4245] = loc_0640; // publish the deferred-callback pointer
}
