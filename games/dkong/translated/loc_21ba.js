// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_21ba  (ROM 0x21BA–0x21D0) — SHARED OBJECT-SPRITE TAIL. (23 bytes).
 * 13 entries reach `jp 0x21ba` (9 exx'd from 1f72's branches, 4 non-exx'd from
 * loc_215f/entry_2118/0x24xx). Copies the 4 sprite fields (ix+3,7,8,5) -- OUT OF
 * ORDER, do not sort -- to the buffer HL, then jp 0x1f8d (1f72's loop advance).
 *
 * ** THE LEADING exx IS A CONTRACT: modelled LITERALLY. ** After
 * regs.exx() the loop's main set (HL buffer / IX obj / DE stride / B count) is
 * active for 0x1f8d, whatever the caller's entry state. NOT special-cased.
 */
export function loc_21ba(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.exx(); // Restores the loop main set for the 9 exx'd callers
  m.step(0x21bb, 4); // exx
  regs.a = mem.read8(R(0x03));
  m.step(0x21be, 19); // ld a,(ix+0x03)
  mem.write8(regs.hl, regs.a);
  m.step(0x21bf, 7); // ld (hl),a
  regs.l = regs.inc8(regs.l);
  m.step(0x21c0, 4); // inc l
  regs.a = mem.read8(R(0x07));
  m.step(0x21c3, 19); // ld a,(ix+0x07)
  mem.write8(regs.hl, regs.a);
  m.step(0x21c4, 7); // ld (hl),a
  regs.l = regs.inc8(regs.l);
  m.step(0x21c5, 4); // inc l
  regs.a = mem.read8(R(0x08));
  m.step(0x21c8, 19); // ld a,(ix+0x08)
  mem.write8(regs.hl, regs.a);
  m.step(0x21c9, 7); // ld (hl),a
  regs.l = regs.inc8(regs.l);
  m.step(0x21ca, 4); // inc l
  regs.a = mem.read8(R(0x05));
  m.step(0x21cd, 19); // ld a,(ix+0x05)
  mem.write8(regs.hl, regs.a);
  m.step(0x21ce, 7); // ld (hl),a -- (no inc l after the 4th)
  m.step(0x1f8d, 10); // jp 0x1f8d -- 1f72's loop continuation (SCC)
  return m.call(0x1f8d);
}
