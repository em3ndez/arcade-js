// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_ef, loc_f0, loc_f1, loc_f2, loc_f3, loc_f4, loc_f5, loc_f6, loc_f7, loc_f8,
  loc_bd, loc_bf, FLIP_SCREEN, loc_2400,
} from "./names.js";

/**
 * seedStateBlockConstants -- stamp the $ef-$f8 zero-page "state block" back to its
 * fixed startup constants, drive the flip-screen output latch, and clear the
 * $bd/$bf status pair.
 *
 * ROLE IN THE MACHINE. The cells at $ef..$f8 form a contiguous block of machine
 * state (orientation/mirror bytes, difficulty and pacing seeds, and companions read
 * by later seeders such as seedPlayerShotStartCells and seedWaveState). At power-on
 * / attract reset the block must be planted with the exact constants the original
 * ROM planted, because downstream routines XOR-fold against these bytes -- a wrong
 * value here silently corrupts every start coordinate derived from it. This is the
 * straight-line seeder that does that planting: no branches, no sub-calls, no input.
 *
 * WHY THESE PARTICULAR CONSTANTS. The values (0xf8, 0xff, 0xfe, 0xfc, 0xe0, 0xc0,
 * 0x40, 0xbf, 0x03, 0x3f) are the ROM's own literals; they are reproduced here in
 * the original write order so the memory mirror matches the 6502 program byte for
 * byte. The order is deliberately NOT ascending by address -- it follows the ROM's
 * store sequence, which is why $f0 is written before $ef, etc.
 *
 * THE TWO NON-BLOCK WRITES. $1c07 (FLIP_SCREEN) is the hardware flip-screen output
 * latch; bit 7 set (0x80) selects a defined display orientation out of reset.
 * $2400 (loc_2400) is a dead store -- it lands on a ROM-space address the board
 * ignores; it exists only so the mirror matches the original exactly. Finally
 * $bd/$bf are a small status pair cleared to zero.
 *
 * GROUNDING: [code]. LIVE-OUT: $ef,$f0,$f1,$f2,$f3,$f4,$f5,$f6,$f7,$f8 (state
 * block), FLIP_SCREEN ($1c07 latch), $bd/$bf, and the ignored $2400 store.
 */
export function seedStateBlockConstants(m) {
  const { mem8 } = m;
  // Plant the $ef..$f8 state block with the ROM's fixed constants, in the ROM's
  // original store order (not address order) so the memory mirror is byte-exact.
  // Each byte is a seed later routines fold against; a wrong value here propagates.
  mem8[loc_f0] = 0xf8;
  mem8[loc_f3] = 0xff;
  mem8[loc_f4] = 0xfe;
  mem8[loc_f8] = 0xfc;
  mem8[loc_f1] = 0xe0;
  mem8[loc_ef] = 0xc0;
  mem8[loc_f2] = 0x40;
  mem8[loc_f5] = 0xbf;
  mem8[loc_f7] = 0x03;
  mem8[loc_f6] = 0x3f;
  // Drive the hardware flip-screen latch: bit7 set selects a defined orientation.
  mem8[FLIP_SCREEN] = 0x80; // flip-screen latch: bit7 set
  // Dead store to ROM-space $2400: the board ignores it; kept for a byte-exact mirror.
  mem8[loc_2400] = 0x80; // dead store, ignored by the board
  // Clear the $bd/$bf status pair to a known-zero baseline.
  mem8[loc_bd] = 0x00;
  mem8[loc_bf] = 0x00;
}
