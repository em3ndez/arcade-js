// SPDX-License-Identifier: GPL-3.0-only
// The address->function table m.call() dispatches through. SKELETON (§2): the translated layer does not
// exist yet, so this is EMPTY — reset() dispatches the 6502 reset vector and the first m.call throws
// NotImplemented (the boot-gap crawl, §3). Once translation starts, gen-registry.mjs writes
// translated/_registry.generated.js and this imports ROUTINE_ENTRIES from it (see games/galaxian/routines.js).

export const ROUTINES = new Map();

export function buildRoutines() {
  return new Map(ROUTINES);
}
