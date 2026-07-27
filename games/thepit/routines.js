// SPDX-License-Identifier: GPL-3.0-only
/**
 * The Pit routine registry — the address→function table the whole machine
 * dispatches through.
 *
 * A `Map<romAddr, fn>` holding every translated routine. Every inter-routine call in
 * translated/ is written `m.call(0xADDR)` rather than a direct `loc_ADDR(m)`; `m.call`
 * looks the address up in this table and invokes it. The reset vector (0x0000) and the
 * vblank-NMI vector (0x0066) are entries here too, so the Machine boots and services
 * interrupts through the same seam every other call uses.
 *
 * BROWSER-SAFE STATIC REGISTRY. The Map is a static import list generated from
 * translated/ by tools/gen-thepit-registry.mjs (_registry.generated.js). It used to be
 * discovered at runtime with node:fs + file:// dynamic imports — which works in Node
 * (tests, render.js) but a BROWSER has neither, so the web player could not build the
 * registry ("Cross-origin script load denied"). The generated file imports every
 * routine over normal relative paths, so it loads in Node and the browser alike, like
 * DK's registry. Regenerate it after adding/removing a translated routine:
 *     node tools/gen-thepit-registry.mjs
 * A sync-check test (games/thepit/test/registry-sync.test.js) fails if it goes stale.
 */

import { ORACLE_ROUTINES } from "./translated/_registry.generated.js";

// Re-exported so the Machine constructor can build its registry synchronously from
// the static table (a browser worker does `new Machine(rom, {...})` with no routines).
export { ORACLE_ROUTINES };

/**
 * Build the oracle registry: address → routine fn. Kept ASYNC (returns a fresh copy)
 * so callers that awaited the old fs-discovery builder (`Machine.create`, emit.js) need
 * no change, and so each Machine gets its own Map to layer overrides onto without
 * mutating the shared table.
 *
 * @returns {Promise<Map<number, function>>} addr → routine fn
 */
export async function buildRoutines() {
  return new Map(ORACLE_ROUTINES);
}
