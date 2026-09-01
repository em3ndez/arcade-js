// SPDX-License-Identifier: GPL-3.0-only
import { loc_2027 } from "./names.js";
import { loadSpriteDescriptor } from "./loadSpriteDescriptor.js";

// Read the sprite descriptor at the object move-record base into DE/A/C/B and repoint HL at C:A.
export function loc_0430(m) {
  return loadSpriteDescriptor(m, loc_2027);
}
