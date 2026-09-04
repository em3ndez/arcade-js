// SPDX-License-Identifier: GPL-3.0-only
import { bootInit } from "./bootInit.js";

// Reset vector: tail-hand to boot init, passing through the attract-loop generator the engine drives.
// Not a generator itself.
export function resetEntry(m) {
  return bootInit(m);
}
