// SPDX-License-Identifier: GPL-3.0-only
import { fillByteRun } from "./fillByteRun.js";
/**
 * blankActorSpriteBand — erase one actor's on-screen sprite by zeroing its sprite band.
 *
 * WHAT IT IS
 *   ROM 0x3553-0x355a. Grounding: [seen].
 *
 *   The game keeps every moving thing — enemies, projectiles, the eagle, and the rest — as a
 *   fixed-stride "actor record" in work RAM. The leading run of that record is the actor's
 *   SPRITE BAND: the bytes that describe how the actor is drawn this frame (its on-screen
 *   coordinates, tile/shape index, colour attribute, and animation cursor). While those bytes are
 *   non-zero the actor shows up in the sprite output; writing zero across the whole band makes the
 *   actor vanish from the screen — a hardware sprite parked at coordinate zero with a blank shape
 *   draws nothing visible.
 *
 * ROLE IN THE MACHINE
 *   This is the single "make this actor disappear" primitive, reached whenever an actor leaves
 *   play. Enemy handlers tail into it at the moment an enemy reaches its arrival point, when an
 *   actor's frame-hold lapses, and when an object's frame timer expires — every such exit ends by
 *   blanking the record's sprite band so the sprite stops being drawn on the next frame.
 *
 * HOW IT WORKS
 *   It clears a fixed-length run of bytes starting at the actor record that the caller hands in
 *   through the index pointer (IX), setting the fill value to zero and the length to the full band
 *   width, then defers the actual writing to the machine's byte-run fill primitive at ROM 0x0010.
 *
 * LIVE-OUT: HL = the advanced pointer sitting just past the filled run (record base + band width),
 * and B = 0 (the fill counter, drained to zero by the fill). The fill primitive sets both, so a
 * caller that tails straight out of here inherits that exit state. The zero fill value is a fixed
 * input to this routine, never read back.
 */

// The band is cleared to all-zero: a zeroed sprite record produces no visible sprite.
const BAND_FILL = 0x00; // the band is cleared to zero
// Width of the sprite band within an actor record: 0x17 (23) consecutive bytes are erased.
const BAND_LEN = 0x17;  // bytes in the sprite band

// `base` is the actor-record pointer the caller is working on, defaulting to the index register
// (IX) that the enemy/object dispatch keeps aimed at the current record.
export function blankActorSpriteBand(m, base = m.regs.ix) {
  // Zero BAND_LEN bytes from the record base by handing the address, fill value, and length to the
  // shared byte-run fill primitive (ROM 0x0010) — the same memset the engine uses to clear RAM
  // blocks and paint tile runs. It writes the run and hands back the advanced pointer and drained
  // counter as this routine's exit state (see LIVE-OUT).
  return fillByteRun(m, base, BAND_FILL, BAND_LEN);
}
