// SPDX-License-Identifier: GPL-3.0-only
/**
 * requestSound4 — request sound command 4 from the sound driver.  ROM 0x4c5f.
 *
 * The smallest kind of sound trigger: it names one fixed sound — command 4 — and
 * hands it to the shared enqueue body, which marks it pending and drops it into the
 * next free slot of the 8-slot sound ring for the sound driver to drain. It is one of
 * a fan of near-identical stubs, each naming a different fixed sound; this one is
 * command 4. Which effect that plays is not yet known, so the name records only what
 * the code does — request that command — not the sound itself.
 *
 * The enqueue body is still the frozen oracle, so the chosen command is handed to it
 * the way it expects — the one genuine oracle boundary here — rather than as a plain
 * argument. A later pass that retires the oracle collapses this to a single named call
 * (enqueueSoundCommand(m, 4)); until then it stays a call across that boundary, which
 * is also why the match against the oracle is exact down to the registers.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4c5f.test.js.
 * GATE:     crafted-entry — command 4 is never requested in attract, so the entry is a
 *           real captured machine state the routine is run on, with the ring write
 *           position swept across all eight slots; diffed against the oracle over RAM
 *           and registers (exact, because the enqueue body is shared unchanged).
 * LIVE-OUT: memory-only — the filled ring slot and the advanced write pointer, both
 *           written by the shared body. No caller reads the leftover command byte.
 * NAMES:    none used directly — this stub touches no RAM itself; the shared enqueue
 *           body owns SOUND_HEAD / SOUND_RING (see enqueueSoundCommand).
 */
export function requestSound4(m) {
  // Select sound command 4, then hand it to the shared enqueue body; that body's
  // return unwinds straight to this stub's own caller.
  m.regs.a = 4;
  return m.call(0x4ca5);
}
