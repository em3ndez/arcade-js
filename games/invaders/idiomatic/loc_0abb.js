// SPDX-License-Identifier: GPL-3.0-only
import { loc_0072 } from "./loc_0072.js";

// Attract task bit0: re-enter the vblank in-game record tail. Unlike the normal in-game entry, the
// fleet-march beat is not run first -- this arm goes straight to the record tail.
export function loc_0abb(m) {
  return loc_0072(m);
}
