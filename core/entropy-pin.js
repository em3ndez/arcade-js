// SPDX-License-Identifier: GPL-3.0-only
/**
 * Entropy pinning — a game-agnostic TEST-ONLY seam that makes a game's RNG deterministic and
 * identical between the JS translation and MAME. The shipped game never pins.
 *
 * Why it is needed, how to discover a game's spin counter, the cycle-neutral MAME-side mirror,
 * and the `manifest.entropyPin` field spec: docs/idiomatic-generation.md, "Entropy pinning".
 */

/** Pin `cfg.seedBytes`/`cfg.redirectReads` on a Machine before running it; wraps `mem` in place. */
export function installEntropyPin(machine, cfg) {
  if (!cfg) return machine;
  const drop = new Set(cfg.seedBytes || []);
  const redirect = new Map((cfg.redirectReads || []).map((r) => [r.from, r.to]));
  if (drop.size === 0 && redirect.size === 0) return machine;

  const mem = machine.mem;
  const baseRead = mem.read8.bind(mem);
  const baseWrite = mem.write8.bind(mem);

  // read16 composes from read8 in the memory layer, so it inherits the redirect for free.
  mem.read8 = (addr) => baseRead(redirect.has(addr) ? redirect.get(addr) : addr);
  mem.write8 = (addr, val) => {
    if (drop.has(addr)) return;
    baseWrite(addr, val);
  };
  return machine;
}

/** Render `cfg.romPatches` as "AAAA:VV,..." for the ENTROPY_PIN env var read by pin_entropy.lua. */
export function entropyPinRomSpec(cfg) {
  if (!cfg || !cfg.romPatches) return "";
  return cfg.romPatches
    .map((p) => `${p.at.toString(16).padStart(4, "0")}:${p.to.toString(16).padStart(2, "0")}`)
    .join(",");
}
