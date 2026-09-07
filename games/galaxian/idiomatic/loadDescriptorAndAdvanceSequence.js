// SPDX-License-Identifier: GPL-3.0-only

/**
 * loadDescriptorAndAdvanceSequence — attract-sequence state 13: load a screen descriptor and step on.
 *
 * WHAT IT IS
 *   One state of the top-level attract sequence. It unpacks a packed flag-bitmask descriptor from ROM into
 *   the formation/flag block, copies the fixed 8-byte template that follows the bitmask into the template
 *   buffer, resets a couple of status cells, advances the sequence, and publishes a deferred-callback
 *   pointer the following steps will invoke.
 *
 * ROLE IN THE MACHINE
 *   Dispatched off SEQUENCE_STATE by runAttractSequenceAndAdvanceOnCredit (state 13). The descriptor at
 *   ROM 0x051b is a bit-per-flag bitmask; unpackBitmaskToFlagBytes expands it into the 0x4100 flag block
 *   and returns a pointer sitting just past it, on the 8-byte template that gets copied to loc_4218.
 *   Clears FRAME_COUNTER (0x425f), sets loc_421d, bumps SEQUENCE_STATE (0x400a), stamps the VRAM fill
 *   cursor low byte (0x400b) to 150, and publishes ROM pointer loc_0640 into loc_4245.
 *
 * ROM 0x02fd.  Grounding: [seen].
 */
import { unpackBitmaskToFlagBytes } from "./unpackBitmaskToFlagBytes.js";
import {
  loc_051b,
  loc_4218,
  FRAME_COUNTER,
  loc_421d,
  SEQUENCE_STATE,
  VRAM_WRITE_PTR,
  loc_4245,
  loc_0640,
} from "./names.js";

// Fixed-size template that trails the descriptor bitmask in ROM.
const TEMPLATE_BYTES = 8;

export function loadDescriptorAndAdvanceSequence(m) {
  const { mem8, mem16 } = m;

  // Unpack the descriptor bitmask into the flag block; the returned pointer sits on the template.
  const template = unpackBitmaskToFlagBytes(m, loc_051b);
  // Copy the 8-byte template that follows the bitmask into the template buffer at loc_4218.
  for (let i = 0; i < TEMPLATE_BYTES; i++) mem8[loc_4218 + i] = mem8[template + i];

  // Reset the frame counter and status cell, advance the sequence, seed the fill cursor, and publish the
  // deferred-callback pointer the next steps will run.
  mem8[FRAME_COUNTER] = 0;
  mem8[loc_421d] = 1;
  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1;
  mem8[VRAM_WRITE_PTR] = 150; // stamp the counter cell
  mem16[loc_4245] = loc_0640; // publish the deferred-callback pointer
}
