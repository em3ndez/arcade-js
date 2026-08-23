// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * Step one object's animation sequence for the record based at IX.
 *
 * +0x0e is a frame-hold counter: while non-zero it decrements and returns (the current frame
 * holds). On expiry it walks the sequence stream addressed little-endian by +0x0c:+0x0d — a 0xff
 * opcode reloads that pointer from the next two stream bytes and re-reads; any other byte starts a
 * 3-byte frame record (byte0 -> +0x10, byte1 -> +0x0f, byte2 -> +0x0e, the new hold) — after which
 * the advanced pointer is stored back to +0x0c:+0x0d.
 *
 * LIVE-OUT: memory only — all state persists in the record; a leaf that calls nothing.
 */
export function advanceObjectAnimationFrame(m, rec = m.regs.ix) {
  const { mem8 } = m;

  if (mem8[rec + 0x0e] !== 0) {
    mem8[rec + 0x0e] = mem8[rec + 0x0e] - 1; // still holding this frame
    return;
  }

  for (;;) {
    let ptr = mem8[rec + 0x0c] | (mem8[rec + 0x0d] << 8);
    const op = mem8[ptr];
    if (op === 0xff) { // reload the stream pointer from the next two bytes, then re-read
      ptr = u16(ptr + 1);
      mem8[rec + 0x0c] = mem8[ptr];
      ptr = u16(ptr + 1);
      mem8[rec + 0x0d] = mem8[ptr];
      continue;
    }

    mem8[rec + 0x10] = op; // tile
    ptr = u16(ptr + 1);
    mem8[rec + 0x0f] = mem8[ptr]; // attribute
    ptr = u16(ptr + 1);
    mem8[rec + 0x0e] = mem8[ptr]; // new hold
    ptr = u16(ptr + 1);
    mem8[rec + 0x0c] = ptr; // store the advanced pointer (low)
    mem8[rec + 0x0d] = ptr >> 8; // store the advanced pointer (high)
    return;
  }
}
