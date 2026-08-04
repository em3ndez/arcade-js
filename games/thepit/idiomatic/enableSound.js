// SPDX-License-Identifier: GPL-3.0-only
/**
 * enableSound — switch the master sound-enable line on (unmute the audio).  ROM 0x4c4d.
 *
 * The audio hardware has a single master enable line: while it is high the sound
 * hardware plays, while it is low everything is silenced. This routine drives that
 * line high. It is the "on" half of a two-routine pair that shares the one line —
 * its mirror (ROM 0x4c47) drives the same line low to mute. Boot and each
 * round/screen setup mute the audio while they rebuild the display, then call this
 * to switch it back on; the per-frame service also re-asserts it. There are no
 * inputs and no choice: it always turns sound on.
 *
 * On this hardware the control lines live in an addressable latch — one line per
 * address, and each store takes only the low bit of its value — so writing 1 to the
 * sound-enable address is what pulls that line high.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4c4d.test.js.
 * GATE:     real-dispatch — the captured boot / round-setup dispatches; contract is
 *           RAM + pc + SP + the sound-enable control line, plus a forced-off entry
 *           proving it genuinely raises the line (not a re-read of an already-high
 *           one). Teeth: a mute twin (drives the line low, the mirror routine's
 *           effect) is caught by the control-line compare. Reached from boot
 *           (coldBootInit), round setup, and the per-frame service onward.
 * LIVE-OUT: the hardware sound-enable line, driven high. No work RAM is touched and
 *           no register or flag is live out — every caller's next act is another
 *           call that reloads before it reads, so the value the pair leaves is dead.
 * NAMES:    none from names.js — 0xb003 is the sound-enable control-latch address
 *           (I/O, one line per address), not work RAM; kept hex like the other latch
 *           addresses.
 */
export function enableSound(m) {
  // Pull the master sound-enable line high. Each control-latch address carries one
  // line and takes the low bit of the written value, so storing 1 turns sound on.
  m.mem8[0xb003] = 1;
}
