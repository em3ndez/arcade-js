// SPDX-License-Identifier: GPL-3.0-only
/**
 * The Pit routine registry — the address→function table the whole machine
 * dispatches through.
 *
 * A `Map<romAddr, fn>` holding every translated routine. Every inter-routine call
 * in translated/ is written `m.call(0xADDR)` rather than a direct `loc_ADDR(m)`;
 * `m.call` looks the address up in this table and invokes it. The reset vector
 * (0x0000) and the vblank-NMI vector (0x0066) are entries here too, so the Machine
 * boots and services interrupts through the same seam every other call uses.
 *
 * BUILT BY DYNAMIC IMPORT, not by a hand-maintained import list like DK's. The Pit
 * has ~150 translated `loc_XXXX.js` files (too many to enumerate), so the builder
 * `fs.readdirSync`s the translated directory and `await import()`s each one. That is
 * why the builder is ASYNC — a dynamic import cannot be awaited from a constructor.
 * `Machine.create()` / emit.js await `buildRoutines()` and hand the resulting Map to
 * the Machine.
 *
 * WHICH EXPORTS CLAIM AN ADDRESS. Only names of the exact shape `loc_hhhh`
 * (ADDR_NAME below, a single 4-hex group anchored at both ends) sit at a distinct
 * ROM address. The translator's helper splits are named `loc_<parent>_<addr>`
 * (`loc_14cd_1515`) or `loc_<parent>_<word>` (`loc_1468_adj`); those have a second
 * underscore group and therefore do NOT match, so they stay direct-called inside
 * their parent module and never claim an address. This includes the loc_0066 NMI
 * monolith, whose 16 exports (loc_0066, loc_00a5, … loc_019c) are each a real ROM
 * address and each SHOULD register — they match the single-group shape and do.
 *
 * A collision (two different names claiming one address) means a helper leaked
 * through the filter; the builder throws naming both so it can be found, rather
 * than silently letting one shadow the other.
 */

import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const TRANSLATED_DIR = join(HERE, "translated");

/** A routine file: loc_ + exactly 4 hex digits + .js. Excludes .test.js and any
 *  helper-named file. (Helpers are exports WITHIN a module, not their own files,
 *  but the same shape is required either way.) */
const ROUTINE_FILE = /^loc_[0-9a-f]{4}\.js$/;

/** An export that owns a ROM address: loc_ + exactly 4 hex digits, both ends
 *  anchored so `loc_14cd_1515` / `loc_1468_adj` (two groups) do not match. */
const ADDR_NAME = /^loc_([0-9a-f]{4})$/;

/**
 * Build the oracle registry by importing every translated loc_XXXX.js and mapping
 * each single-group `loc_hhhh` export to ROM address 0xhhhh.
 *
 * @returns {Promise<Map<number, function>>} addr → routine fn
 */
export async function buildRoutines() {
  const byAddr = new Map();
  const owner = new Map(); // addr -> claiming name, for a precise collision message

  const files = readdirSync(TRANSLATED_DIR)
    .filter((f) => ROUTINE_FILE.test(f))
    .sort(); // deterministic import + collision-report order

  for (const file of files) {
    const url = pathToFileURL(join(TRANSLATED_DIR, file)).href;
    const mod = await import(url);
    for (const [name, fn] of Object.entries(mod)) {
      if (typeof fn !== "function") continue;
      const m = ADDR_NAME.exec(name);
      if (!m) continue; // helper split / non-routine export -- stays direct-called
      const addr = parseInt(m[1], 16);
      if (byAddr.has(addr)) {
        throw new Error(
          `routine registry: 0x${addr.toString(16).padStart(4, "0")} claimed by ` +
            `both ${owner.get(addr)} and ${name} (in ${file}) — one is a helper that ` +
            "leaked through the loc_hhhh filter. A helper must be named " +
            "loc_<parent>_<addr> (two groups) so it does not claim an address.",
        );
      }
      byAddr.set(addr, fn);
      owner.set(addr, name);
    }
  }

  if (!byAddr.has(0x0000)) {
    throw new Error("routine registry: no reset routine at 0x0000 (loc_0000 missing)");
  }
  if (!byAddr.has(0x0066)) {
    throw new Error("routine registry: no NMI routine at 0x0066 (loc_0066 missing)");
  }
  return byAddr;
}
