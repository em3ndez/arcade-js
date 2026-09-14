// SPDX-License-Identifier: GPL-3.0-only
import { OBJ_DEPTH, DEPTH_LO, DEPTH_HI } from "./names.js";

// When the guard byte is clear and one counter sits less than 0x0c above a reference,
// nudge that counter up to the reference plus 0x0f, capped at a ceiling of 0xf0.
export function snapCoordUpToReference(m) {
  const { mem8 } = m;
  if (mem8[DEPTH_LO] !== 0) return;
  if (mem8[OBJ_DEPTH] - mem8[DEPTH_HI] >= 0x0c) return;
  let v = mem8[DEPTH_HI] + 0x0f;
  if (v >= 0xf0) v = 0xf0;
  mem8[OBJ_DEPTH] = v;
}
