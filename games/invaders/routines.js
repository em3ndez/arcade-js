// SPDX-License-Identifier: GPL-3.0-only
// The address->function table m.call() dispatches through: reset + the two RST vectors + every
// translated routine. Regenerate after a batch lands: node tools/gen-registry.mjs invaders
import { ROUTINE_ENTRIES } from "./translated/_registry.generated.js";

export const ROUTINES = new Map(ROUTINE_ENTRIES);

export function buildRoutines() {
  return new Map(ROUTINES);
}
