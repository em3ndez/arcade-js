// SPDX-License-Identifier: GPL-3.0-only
import { loadSpriteDescriptor } from "./loadSpriteDescriptor.js";
import { coordToScreenAddr } from "./coordToScreenAddr.js";
import { loc_2087 } from "./names.js";

// Load the sprite descriptor at the record cell, then fold its pointer into a screen address.
export function resolveSpriteScreenAddr(m) {
  const [hl] = loadSpriteDescriptor(m, loc_2087);
  return coordToScreenAddr(m, hl);
}
