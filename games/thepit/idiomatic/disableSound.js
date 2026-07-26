// SPDX-License-Identifier: GPL-3.0-only
/**
 * disableSound — pull the sound-enable control line low, silencing the audio.  ROM 0x4c47.
 *
 * The Pit gates its whole audio path behind a single hardware control line (bit 3
 * of the addressable control latch). This routine drives that line to 0, which
 * mutes sound. It is the mute half of a two-entry pair: its twin at 0x4c4d drives
 * the same line to 1 to un-mute. Cold boot and round setup both call it, to keep
 * the cabinet quiet while the game state is being rebuilt.
 *
 * It takes no inputs, reads no memory, and returns nothing — its only effect is
 * the one control-line write. (The oracle also parks a scratch 0 in a value
 * register on the way; nothing downstream reads it, so it is dropped here.)
 *
 * Memory-equivalent to the frozen oracle — equivalence-4c47.test.js.
 * GATE:     crafted-entry — the real boot dispatch (where the effect is confirmed
 *           against the oracle), plus a SOUND-ON entry (the enable line pre-set on
 *           both sides) proving it actually pulls the line low. Teeth: a twin that
 *           drives the line high instead is caught on the sound-on entry.
 * LIVE-OUT: the sound-enable control line only — no work RAM is read or written,
 *           and the value registers the oracle leaves behind are dead scratch.
 * NAMES:    none from ram.js — the target is a fixed hardware control-latch address
 *           (0xb003 selects control-latch bit 3, the sound-enable line), not work RAM.
 */
export function disableSound(m) {
  // Drive the sound-enable control line low. Only the low bit of the datum reaches
  // the latch, so a plain 0 clears it.
  m.mem.write8(0xb003, 0);
}
