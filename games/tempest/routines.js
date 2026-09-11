// SPDX-License-Identifier: GPL-3.0-only
// The address->function table m.call() dispatches through. §3: routines are the translated set generated
// into translated/_registry.generated.js (regenerate: node tools/gen-registry.mjs tempest). The boot
// dispatches the reset vector (0xFFFC -> 0xD93F); an unregistered target throws NotImplemented (the next
// boot-gap-crawl target). Empty until the first §3 routine lands; grows batch by batch.

import { ROUTINE_ENTRIES } from "./translated/_registry.generated.js";

export const ROUTINES = new Map(ROUTINE_ENTRIES);

export function buildRoutines() {
  return new Map(ROUTINES);
}
