// SPDX-License-Identifier: GPL-3.0-only
/**
 * Entropy pinning — a game-agnostic TEST-ONLY seam that makes a game's RNG deterministic and
 * IDENTICAL between the JS translation and MAME, so a pixel/state diff can validate everything
 * *except* the entropy timing (which is the one thing that legitimately cannot match).
 *
 * WHY THIS EXISTS. Arcade games almost universally derive randomness from a "spin counter": the
 * main loop increments a RAM byte as fast as it can while waiting for the vblank interrupt, and
 * mixes that count into a seed once per frame. The count is therefore a race between the CPU and
 * the beam — exquisitely sensitive to cycle-exact timing. A translation that is cycle-*accurate*
 * but not cycle-*exact* to the last T-state (ours, especially after the m.step collapse) fits a
 * different number of spins per frame, so the seed forks within a few frames and every
 * RNG-driven sprite drifts apart forever. The interrupt counter is the synced twin; only the
 * spin count forks. See docs/08-entropy-pinning.md for the discovery method (an attract-mode RAM
 * diff auto-identifies the culprit: the byte that forks while the interrupt counter stays synced).
 *
 * WHAT IT DOES. Given a per-game config (see `manifest.entropyPin`), it pins the RNG working set
 * to a constant on the JS side by intercepting the memory seam:
 *   - `seedBytes`: drop writes to each — the byte keeps its boot value (0), so its single writer
 *     (the once-per-frame mix routine) can no longer fork it. Everything downstream of the seed
 *     is then deterministic without touching any other address.
 *   - `redirectReads`: reads of `from` return `to` instead — used to point the spin counter's
 *     direct readers at the pinned seed, so they too see 0. This sidesteps having to find every
 *     writer of the spin counter, and avoids depending on the interrupt counter (which can carry
 *     ±1 cutscene jitter from the DMA-timing artifact).
 *
 * The MAME side achieves the SAME pin with cycle-neutral ROM operand patches (`manifest
 * .entropyPin.romPatches`, applied by tools/lua/pin_entropy.lua) — redirecting the same stores
 * and reads at the instruction level. Both sides must express the identical intent; the config
 * carries both representations so they can be checked against each other.
 *
 * This is for the equivalence HARNESS only. The shipped game never pins — real randomness stays.
 */

/**
 * Install the entropy pin on a Machine (before running it).
 * @param {object} machine  a constructed Machine (its `.mem` seam is wrapped in place)
 * @param {object} [cfg]     manifest.entropyPin: { seedBytes?, redirectReads? }
 * @returns {object} the same machine, for chaining
 */
export function installEntropyPin(machine, cfg) {
  if (!cfg) return machine;
  const drop = new Set(cfg.seedBytes || []);
  const redirect = new Map((cfg.redirectReads || []).map((r) => [r.from, r.to]));
  if (drop.size === 0 && redirect.size === 0) return machine;

  const mem = machine.mem;
  const baseRead = mem.read8.bind(mem);
  const baseWrite = mem.write8.bind(mem);

  // Reads of a redirected address return the target's live value. The seed is pinned (writes
  // dropped) so a redirect onto it yields the constant boot value. read16 is composed from
  // read8 in the memory layer, so it inherits the redirect on its low/high byte automatically.
  mem.read8 = (addr) => baseRead(redirect.has(addr) ? redirect.get(addr) : addr);
  // Dropping the seed's writes freezes it at its boot value; every other write passes through.
  mem.write8 = (addr, val) => {
    if (drop.has(addr)) return;
    baseWrite(addr, val);
  };
  return machine;
}

/**
 * Render `manifest.entropyPin.romPatches` as the compact spec string the MAME-side applier
 * (tools/lua/pin_entropy.lua) reads from the ENTROPY_PIN env var: "AAAA:VV,AAAA:VV,...".
 * @param {object} [cfg] manifest.entropyPin: { romPatches?: [{at, to}] }
 * @returns {string}
 */
export function entropyPinRomSpec(cfg) {
  if (!cfg || !cfg.romPatches) return "";
  return cfg.romPatches
    .map((p) => `${p.at.toString(16).padStart(4, "0")}:${p.to.toString(16).padStart(2, "0")}`)
    .join(",");
}
