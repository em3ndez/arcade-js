// SPDX-License-Identifier: GPL-3.0-only
// State handler: tick the countdown byte. While it stays nonzero, keep the start-button lamps in step;
// on its zero-cross advance the sequence state and clear the flag-bits block.
import { driveStartButtonLamps } from "./driveStartButtonLamps.js";
import { fillMemoryBlock } from "./fillMemoryBlock.js";
import { loc_4019, SEQUENCE_STATE, FLAG_BITS_BASE } from "./names.js";

const FLAG_BITS_COUNT = 128;

export function loc_0430(m) {
  const { mem8 } = m;

  const remaining = (mem8[loc_4019] - 1) & 0xff;
  mem8[loc_4019] = remaining;
  if (remaining !== 0) {
    driveStartButtonLamps(m);
    return;
  }

  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1;
  fillMemoryBlock(m, FLAG_BITS_BASE, 0, FLAG_BITS_COUNT);
}
