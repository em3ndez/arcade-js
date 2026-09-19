// SPDX-License-Identifier: GPL-3.0-only
/**
 * setup50mConveyorBoard — board setup for 50m: select palette bank 1, select the 50m
 * background tune, then point at the 50m conveyor layout table and run the shared
 * draw-and-finish tail.
 *
 * LIVE-OUT: memory plus the palette-bank output latches (display-read hardware registers).
 */

import { loc_0cc6 } from "./loc_0cc6.js";
import {
  PALETTE_BANK_BIT0,
  PALETTE_BANK_BIT1,
  SND_BGM,
} from "./names.js";

// Hardware palette-bank output latches (NOT work RAM).

export function setup50mConveyorBoard(m) {
  const { regs, mem, mem8 } = m;

  // Palette bank 1 (bit0 set, bit1 clear).
  mem.write8(PALETTE_BANK_BIT0, 0x01);
  mem.write8(PALETTE_BANK_BIT1, 0x00);

  mem8[SND_BGM] = 0x09; // 50m background tune (25m=0x08, 50m=0x09, 75m=0x0A)

  // The table address reaches the tail in a register, so set it last.
  regs.de = 0x3b5d;
  loc_0cc6(m);
}
