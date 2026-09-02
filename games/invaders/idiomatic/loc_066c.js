// SPDX-License-Identifier: GPL-3.0-only
import { loadSpriteDescriptor } from "./loadSpriteDescriptor.js";
import { drawSpriteWithCollision } from "./drawSpriteWithCollision.js";
import { loc_2079 } from "./names.js";

// Decode the shot object's sprite descriptor, then blit its column into video RAM with collision detect.
export function loc_066c(m) {
  loadSpriteDescriptor(m, loc_2079);
  return drawSpriteWithCollision(m);
}
