// SPDX-License-Identifier: GPL-3.0-only
// The address->function table m.call() dispatches through, including the reset (0x0000) and
// vblank-NMI (0x0066) vectors. Regenerate: node tools/gen-registry.mjs frogger

import { ROUTINE_ENTRIES } from "./translated/_registry.generated.js";

export const ROUTINES = new Map(ROUTINE_ENTRIES);

export function buildRoutines() {
  return new Map(ROUTINES);
}
