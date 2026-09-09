// SPDX-License-Identifier: GPL-3.0-only
import { loc_42, loc_43, loc_62, loc_63, loc_72, loc_73, loc_f0, loc_f1, loc_f2 } from "./names.js";

/**
 * seedPlayerShotStartCells -- an init leaf; seeds six player/shot start cells from fixed
 * constants. Three are EOR-folded against the orientation bytes (0xf0..0xf2), which mirrors
 * the start coordinates for a flipped cabinet; the other two are the un-mirrored midline seed.
 * @param m the machine
 */
export function seedPlayerShotStartCells(m) {
  const { mem8 } = m;
  mem8[loc_43] = 0x10 ^ mem8[loc_f2];
  mem8[loc_63] = 0x80;
  mem8[loc_62] = 0x80;
  mem8[loc_73] = 0x08 ^ mem8[loc_f0];
  mem8[loc_72] = 0x0c ^ mem8[loc_f1];
  mem8[loc_42] = 0x11 ^ mem8[loc_f2];
}
