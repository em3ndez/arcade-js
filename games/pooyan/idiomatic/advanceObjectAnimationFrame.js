// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * advanceObjectAnimationFrame — step one on-screen object's animation by one tick.
 * ROM 0x4006. [seen]
 *
 * The general per-object animation sequencer, shared by most moving actors (pooyas, the
 * eagle, descending/rising enemies). Each object record carries its own little animation
 * program and a place in it, and this routine advances that program by exactly one frame's
 * worth of time when its owner's state handler calls it.
 *
 * Timing is a frame-hold counter at rec+0x0e: it says how many more frames the current
 * picture should stay on screen. While it is non-zero the routine simply counts it down and
 * leaves — the object holds its current tile and attribute for another frame.
 *
 * When the hold expires it is time to fetch the next frame from the object's animation
 * script — a byte stream in ROM/RAM addressed little-endian by the pointer bytes at
 * rec+0x0c (low) and rec+0x0d (high). The stream is read one entry at a time:
 *   - A 0xff byte is a jump/loop opcode: the two bytes after it are a new stream address,
 *     which replaces the pointer, and reading resumes there (this is how a script loops
 *     back to its start or chains to another). It never draws a frame by itself, so the
 *     read repeats until a real frame entry is found.
 *   - Any other byte begins a 3-byte frame entry: the tile code (into rec+0x10), the sprite
 *     attribute / colour byte (into rec+0x0f), and the new hold count (into rec+0x0e). The
 *     pointer is advanced past all three and stored back to rec+0x0c:rec+0x0d so the next
 *     expiry picks up where this one left off.
 *
 * LIVE-OUT: memory only. Everything lives in the object record — the decremented hold, or
 * the freshly loaded tile/attribute/hold and the advanced script pointer. A pure leaf that
 * calls nothing.
 */
export function advanceObjectAnimationFrame(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Frame-hold countdown: while the current picture still has frames left to show, spend
  // one of them and return without touching the script. The picture stays on screen.
  if (mem8[rec + 0x0e] !== 0) {
    mem8[rec + 0x0e] = mem8[rec + 0x0e] - 1; // still holding this frame
    return;
  }

  // Hold expired: fetch the next frame from the animation script. Loop because a 0xff
  // jump entry produces no drawable frame and we must keep reading until a real one lands.
  for (;;) {
    // Reassemble the 16-bit script pointer from its low/high bytes in the record.
    let ptr = mem8[rec + 0x0c] | (mem8[rec + 0x0d] << 8);
    const op = mem8[ptr];
    if (op === 0xff) {
      // Jump/loop opcode: the next two stream bytes are a new script address. Load it into
      // the pointer bytes and go re-read from there (used to loop a cycle or chain scripts).
      ptr = u16(ptr + 1);
      mem8[rec + 0x0c] = mem8[ptr];
      ptr = u16(ptr + 1);
      mem8[rec + 0x0d] = mem8[ptr];
      continue;
    }

    // A real frame entry: three consecutive bytes describe the picture to show next.
    mem8[rec + 0x10] = op; // tile code for this frame
    ptr = u16(ptr + 1);
    mem8[rec + 0x0f] = mem8[ptr]; // sprite attribute / colour byte
    ptr = u16(ptr + 1);
    mem8[rec + 0x0e] = mem8[ptr]; // hold count: how many frames this picture stays up

    // Advance past the 3-byte entry and store the pointer back so the next expiry resumes
    // at the following entry (little-endian: low byte then high byte).
    ptr = u16(ptr + 1);
    mem8[rec + 0x0c] = ptr;
    mem8[rec + 0x0d] = ptr >> 8;
    return;
  }
}
