// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * advanceActorAnimFrame — step one actor's animation by a single frame, walking a byte-coded
 * animation stream stored in the actor's own record.
 *
 * ROM 0x403c-0x4071. Grounding: [seen].
 *
 * ROLE. Every animated actor carries a small state block; the record base is handed in via IY. Six
 * of that record's bytes drive animation:
 *   +0x0c, +0x0d  a little-endian pointer INTO an animation stream (a table of opcodes/frames in
 *                 ROM), remembering where this actor is in its sequence.
 *   +0x0e         a frame-hold countdown: how many more ticks the current frame stays on screen.
 *   +0x0f         a per-frame parameter (copied from the stream — e.g. a secondary attribute).
 *   +0x10         the frame's display value (copied from the stream — e.g. the tile/shape).
 * The animation stream is a compact bytecode: a 0xff byte is a JUMP opcode (reload the pointer and
 * keep reading); any other byte begins a 3-byte frame record — value, parameter, hold.
 *
 * Called once per tick per actor to keep the animation running.
 *
 * A PURE LEAF: all state lives in the record at IY; it calls nothing.
 *
 * LIVE-OUT: memory only — the six record bytes above. The caller reads no register or flag back.
 */
export function advanceActorAnimFrame(m, rec = m.regs.iy) {
  const { mem8 } = m;

  // Frame-hold countdown. While the current frame still has time on it, just tick the hold down by
  // one and leave everything else alone — the actor shows the same frame this tick.
  if (mem8[rec + 0x0e] !== 0) {
    mem8[rec + 0x0e] = mem8[rec + 0x0e] - 1; // still holding this frame
    return;
  }

  // Hold expired: pull the next entry from the animation stream. This loops only to service a 0xff
  // jump opcode (reload the pointer, then read again); a real frame record breaks out with a return.
  for (;;) {
    // Reconstruct the stream pointer from the little-endian pair at +0x0c/+0x0d and read the opcode.
    let ptr = mem8[rec + 0x0c] | (mem8[rec + 0x0d] << 8);
    const op = mem8[ptr];
    if (op === 0xff) { // 0xff = JUMP: the next two stream bytes are the address to continue from
      // Read the new pointer (low byte then high byte) straight out of the stream and store it back
      // into +0x0c/+0x0d, then loop to re-read at the new location. u16 keeps the walk 16-bit.
      ptr = u16(ptr + 1);
      mem8[rec + 0x0c] = mem8[ptr];
      ptr = u16(ptr + 1);
      mem8[rec + 0x0d] = mem8[ptr];
      continue;
    }

    // A frame record: three consecutive stream bytes. First byte is the display value (+0x10),
    // second is the per-frame parameter (+0x0f), third seeds the fresh frame-hold (+0x0e).
    mem8[rec + 0x10] = op;
    ptr = u16(ptr + 1);
    mem8[rec + 0x0f] = mem8[ptr];
    ptr = u16(ptr + 1);
    mem8[rec + 0x0e] = mem8[ptr]; // new hold

    // Advance past the 3-byte record and save the updated stream pointer back into +0x0c/+0x0d
    // (little-endian) so the next tick resumes at the following entry.
    ptr = u16(ptr + 1);
    mem8[rec + 0x0c] = ptr; // store the advanced pointer (low)
    mem8[rec + 0x0d] = ptr >> 8; // store the advanced pointer (high)
    return;
  }
}
