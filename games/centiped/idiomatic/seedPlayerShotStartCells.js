// SPDX-License-Identifier: GPL-3.0-only
import { loc_42, loc_43, loc_62, loc_63, loc_72, loc_73, loc_f0, loc_f1, loc_f2 } from "./names.js";

/**
 * seedPlayerShotStartCells -- an init leaf that stamps six player/shot "start"
 * cells in the zero-page state area back to their fixed power-on values.
 *
 * ROLE IN THE MACHINE. Centipede's player and its shot each carry a small set of
 * coordinate/velocity working cells in low zero-page RAM. Before a life or wave
 * begins those cells must be planted with known constants so the object appears at
 * the correct spot and moving in the correct sense. This routine is one of the
 * leaf seeders the round-setup chain calls to do exactly that: it is straight-line,
 * takes no input beyond the orientation bytes, branches nowhere, and calls nothing.
 *
 * THE FLIP TRICK. Three of the six writes are not plain constants: they are EOR
 * (XOR) folded against the cabinet-orientation bytes at $f0..$f2 ($f0=loc_f0,
 * $f1=loc_f1, $f2=loc_f2). Those orientation bytes are 0x00 on an upright cabinet
 * and 0xff (all bits) when the screen is flipped for a cocktail/flipped install.
 * XORing a start coordinate with 0xff mirrors it about the axis midpoint, so the
 * SAME constant produces the correct on-screen start position in either orientation
 * without a branch. The other two writes ($62/$63 = 0x80) are the un-mirrored
 * midline seed -- 0x80 is the center of an 8-bit coordinate axis, so it needs no
 * flip. This mirrors the original ROM's "seed then EOR the mirror bytes" idiom.
 *
 * GROUNDING: [code] -- read from the routine's own behaviour; no MAME confirmation.
 * LIVE-OUT: zero-page cells $42,$43,$62,$63,$72,$73 (mem8). No return value.
 * @param m the machine
 */
export function seedPlayerShotStartCells(m) {
  const { mem8 } = m;
  // $43 := 0x10 mirrored by the $f2 orientation byte (0x00 upright -> 0x10,
  // 0xff flipped -> 0xef). One of the folded coordinate seeds.
  mem8[loc_43] = 0x10 ^ mem8[loc_f2];
  // $63/$62 := 0x80: the un-mirrored midline seed. 0x80 is the axis center, so it
  // reads the same whichever way the cabinet is oriented -- no fold needed.
  mem8[loc_63] = 0x80;
  mem8[loc_62] = 0x80;
  // $73 := 0x08 mirrored by the $f0 orientation byte; $72 := 0x0c mirrored by $f1.
  // Two more folded start coordinates, each pairing its own constant with its own
  // orientation byte so the shot's start lands correctly in either orientation.
  mem8[loc_73] = 0x08 ^ mem8[loc_f0];
  mem8[loc_72] = 0x0c ^ mem8[loc_f1];
  // $42 := 0x11 mirrored by $f2 -- the partner of the $43 write above, folded
  // against the same orientation byte so the pair stays mutually consistent.
  mem8[loc_42] = 0x11 ^ mem8[loc_f2];
}
