// SPDX-License-Identifier: GPL-3.0-only
import { SCRIPT_WALK_CONTINUE } from "./names.js";

// Clear the state byte to zero.
export function endObjectMotionScript(m) {
  const { mem8 } = m;
  mem8[SCRIPT_WALK_CONTINUE] = 0;
}
