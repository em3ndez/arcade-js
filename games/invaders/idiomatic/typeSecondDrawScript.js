// SPDX-License-Identifier: GPL-3.0-only
import { typeDrawScript } from "./typeDrawScript.js";
import { loc_1dcf } from "./names.js";

// Walk the second attract draw script. Generator; memory-only.
export function* typeSecondDrawScript(m) {
  yield* typeDrawScript(m, loc_1dcf);
}
