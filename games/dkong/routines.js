// SPDX-License-Identifier: GPL-3.0-only
/**
 * Donkey Kong routine registry — the address→function table the whole machine
 * dispatches through, and the swap layer over the ROM address space.
 *
 * A `Map<romAddr, fn>` holding every translated routine. Every inter-routine call in
 * translated/ is written `m.call(0xADDR)` rather than a direct `loc_ADDR(m)`; `m.call`
 * looks the address up in `m.routines` — this base table with the manifest's
 * proven-equal idiomatic routines laid over the top — and invokes it. With no overrides
 * the table returns the oracle, so behaviour is byte-identical; with an override it
 * returns the idiomatic rewrite. The registry IS the patch table over the address
 * space, exactly like patched ROM, so ANY routine is independently swappable.
 *
 * BROWSER-SAFE STATIC REGISTRY. The Map is a static import list generated from
 * translated/ by tools/gen-dkong-registry.mjs (_registry.generated.js). It used to be
 * built by importing four hand-maintained re-export bundles (translated/boot.js,
 * mainloop.js, nmi.js, state0.js) and scanning their exports at load — four files to
 * keep in sync with translated/ by hand. The generated file imports every routine over
 * normal relative paths, so it loads in Node and the browser alike, and nothing needs
 * hand-maintaining. Regenerate it after adding/removing a translated routine:
 *     node tools/gen-dkong-registry.mjs
 * A sync-check test (games/dkong/test/registry-sync.test.js) fails if it goes stale.
 */

import { ORACLE_ROUTINES } from "./translated/_registry.generated.js";

// Re-exported so the Machine constructor can build its registry synchronously from
// the static table (a browser worker does `new Machine(rom, {...})` with no routines).
export { ORACLE_ROUTINES };

/**
 * Build the oracle registry: address → routine fn. Kept ASYNC (returns a fresh copy)
 * to match the shared factory signature (`Machine.create`, emit.js, and machine.js's
 * makeMachineFactory all await it), and so each Machine gets its own Map to layer
 * overrides onto without mutating the shared table.
 *
 * @returns {Promise<Map<number, function>>} addr → routine fn
 */
export async function buildRoutines() {
  return new Map(ORACLE_ROUTINES);
}
