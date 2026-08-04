// SPDX-License-Identifier: GPL-3.0-only
/**
 * addStrided — add a signed byte into each of a run of bytes spaced at a fixed stride.
 *
 * A foundational memory primitive. The caller supplies a start address, a count, a stride and
 * an addend; this read-modify-writes `count` bytes — the one at the start address, the one a
 * stride later, and so on. Each add is taken 8-bit, so a byte WRAPS rather than saturating.
 *
 * The addend is signed in practice: the heaviest use passes -4, and that use therefore
 * DECREMENTS every field it touches. The usual job is nudging a run of sprite fields spaced
 * four bytes apart — one X or one Y column of the sprite buffer — by a delta during board and
 * cutscene setup.
 *
 * The count is tested AFTER each pass rather than before the first, so this is a do-while: the
 * body always runs at least once, and a count of 0 on entry runs the full 256 passes rather
 * than none. No caller passes 0; the loop below keeps that behaviour anyway.
 *
 * The stride and the addend are only read, never written, so a caller that set them up before
 * the call still has them afterwards. A PURE LEAF otherwise: it calls nothing.
 *
 * LIVE-OUT: the run of bytes, each raised by the addend with 8-bit wrap; plus the last byte
 * written, a count run down to 0, and the pointer advanced past the last target with 16-bit
 * wrap, all three left where a caller could read them back.
 */
export function addStrided(m) {
  const { regs, mem } = m;

  const addend = regs.c; // signed: -4 is the common value
  const stride = regs.de; // bytes between successive targets
  // do-while: the count is tested after a pass, so 0 means 256 passes, not zero.
  const count = regs.b === 0 ? 256 : regs.b;

  let ptr = regs.hl;
  let a = 0;
  for (let i = 0; i < count; i++) {
    a = (addend + mem.read8(ptr)) & 0xff; // 8-bit, so it wraps
    mem.write8(ptr, a);
    ptr = (ptr + stride) & 0xffff;
  }

  // The three values left where the caller can read them back: the final byte written,
  // the count run down to 0, and the pointer advanced past the last target.
  regs.a = a;
  regs.hl = ptr;
  regs.b = 0;
}
