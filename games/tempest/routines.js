// SPDX-License-Identifier: GPL-3.0-only
// The address->function table m.call() dispatches through. §2 SKELETON: translated/ is empty, so this is an
// EMPTY map -- reset (0xFFFC -> 0xD93F) hits the first m.call and throws NotImplemented (the §3 boot-gap
// crawl worklist). §3 generates translated/_registry.generated.js; switch this to import ROUTINE_ENTRIES
// from it then (mirror games/centiped/routines.js). Regenerate: node tools/gen-registry.mjs tempest

export const ROUTINES = new Map();

export function buildRoutines() {
  return new Map(ROUTINES);
}
