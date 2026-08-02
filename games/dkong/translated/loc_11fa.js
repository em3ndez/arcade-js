// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_11fa  (ROM 0x11FA–0x1229) — 48 bytes, 28 instructions.
 *
 *   11fa  dd 21 a0 66  ld   ix,0x66a0
 *   11fe  11 28 6a     ld   de,0x6a28
 *   1201  dd 36 00 01  ld   (ix+0x00),0x01
 *   1205  7e           ld   a,(hl)
 *   1206  dd 77 03     ld   (ix+0x03),a
 *   1209  12           ld   (de),a
 *   120a  1c           inc  e
 *   120b  23           inc  hl
 *   120c  7e           ld   a,(hl)
 *   120d  dd 77 07     ld   (ix+0x07),a
 *   1210  12           ld   (de),a
 *   1211  1c           inc  e
 *   1212  23           inc  hl
 *   1213  7e           ld   a,(hl)
 *   1214  dd 77 08     ld   (ix+0x08),a
 *   1217  12           ld   (de),a
 *   1218  1c           inc  e
 *   1219  23           inc  hl
 *   121a  7e           ld   a,(hl)
 *   121b  dd 77 05     ld   (ix+0x05),a
 *   121e  12           ld   (de),a
 *   121f  23           inc  hl
 *   1220  7e           ld   a,(hl)
 *   1221  dd 77 09     ld   (ix+0x09),a
 *   1224  23           inc  hl
 *   1225  7e           ld   a,(hl)
 *   1226  dd 77 0a     ld   (ix+0x0a),a
 *   1229  c9           ret
 *
 * Two call sites: 0x0FF2 (here) and 0x104C.
 *
 * NOT A LOOP AND NOT sub_122a'S TWIN. It shares the `ld a,(hl)` / `ld (de),a` /
 * `inc e` / `inc hl` idiom with sub_122a and sub_11ec and is a DIFFERENT
 * routine: straight-line, no djnz, no branch, 28 instructions to a `ret`.
 * sub_11ec is the worked example of why the idiom decides nothing -- it is
 * near-identical to sub_122a in bytes and inverted in behaviour by one
 * push/pop pair.
 *
 * HL IS A LIVE-IN PARAMETER -- never set here. Six consecutive bytes are read
 * from (HL); HL is left at source+5, NOT source+6, because the last read at
 * 0x1225 is not followed by an `inc hl`.
 *
 * Both callers supply HL adjacently with `ld hl,nn`: 0x3DF4 at 0x0FEF, 0x3DFA
 * at 0x1049 -- stride 6, and this routine reads exactly six bytes. THE STRIDE
 * AND THE READ COUNT AGREE; that agreement is arithmetic and is NOT recorded
 * here as evidence that the six bytes are one record. Nobody has read those
 * bytes.
 *
 * THE IX WRITE ORDER IS LOAD-BEARING: +0x00, +0x03, +0x07, +0x08, +0x05,
 * +0x09, +0x0A -- note +0x05 lands AFTER +0x08. All seven addresses are
 * distinct, so sorting them into ascending order leaves final memory
 * IDENTICAL and no state diff would notice. The write TRACE, however, is
 * gated, so the tidy version goes red. Left in ROM order deliberately.
 *
 * Offsets +0x01, +0x02, +0x04 and +0x06 are not written here. Whether they are
 * padding, written elsewhere, or unused is not established.
 *
 * `inc e`, NOT `inc de`: 8-bit, no carry into D, and it SETS FLAGS where
 * `inc de` sets none. E runs 0x28..0x2B here so the wrap is unexercised, and
 * the flags die at the `ret` -- a wrong version is byte-identical on any real
 * tape. Latent, not absent.
 *
 * The FOURTH (de) write at 0x121E is NOT followed by an `inc e`, so DE exits
 * at 0x6A2B pointing AT the byte just written rather than one past it. The
 * three earlier writes each advance. The asymmetry is real in the bytes.
 */
export function loc_11fa(m) {
  const { regs, mem } = m;

  regs.ix = 0x66a0;
  m.step(0x11fe, 14); // ld ix,0x66a0
  regs.de = 0x6a28;
  m.step(0x1201, 10); // ld de,0x6a28
  // `ld (ix+d),n` -- the IMMEDIATE form (dd 36 d n, 4 bytes), a different
  // instruction from `ld (ix+d),a` (dd 77 d, 3 bytes). Both are 19 T.
  mem.write8((regs.ix + 0x00) & 0xffff, 0x01);
  m.step(0x1205, 19); // ld (ix+0x00),0x01

  regs.a = mem.read8(regs.hl); // HL is the caller's, never set here
  m.step(0x1206, 7); // ld a,(hl)
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a);
  m.step(0x1209, 19); // ld (ix+0x03),a
  mem.write8(regs.de, regs.a);
  m.step(0x120a, 7); // ld (de),a
  regs.e = regs.inc8(regs.e); // `inc e`, NOT `inc de` -- D untouched
  m.step(0x120b, 4); // inc e
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x120c, 6); // inc hl

  regs.a = mem.read8(regs.hl);
  m.step(0x120d, 7); // ld a,(hl)
  mem.write8((regs.ix + 0x07) & 0xffff, regs.a);
  m.step(0x1210, 19); // ld (ix+0x07),a
  mem.write8(regs.de, regs.a);
  m.step(0x1211, 7); // ld (de),a
  regs.e = regs.inc8(regs.e);
  m.step(0x1212, 4); // inc e
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1213, 6); // inc hl

  regs.a = mem.read8(regs.hl);
  m.step(0x1214, 7); // ld a,(hl)
  mem.write8((regs.ix + 0x08) & 0xffff, regs.a);
  m.step(0x1217, 19); // ld (ix+0x08),a
  mem.write8(regs.de, regs.a);
  m.step(0x1218, 7); // ld (de),a
  regs.e = regs.inc8(regs.e);
  m.step(0x1219, 4); // inc e
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x121a, 6); // inc hl

  regs.a = mem.read8(regs.hl);
  m.step(0x121b, 7); // ld a,(hl)
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a); // +0x05 AFTER +0x08 -- see above
  m.step(0x121e, 19); // ld (ix+0x05),a
  mem.write8(regs.de, regs.a);
  m.step(0x121f, 7); // ld (de),a
  // No `inc e` here. DE stays at 0x6A2B.
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1220, 6); // inc hl

  regs.a = mem.read8(regs.hl);
  m.step(0x1221, 7); // ld a,(hl)
  mem.write8((regs.ix + 0x09) & 0xffff, regs.a);
  m.step(0x1224, 19); // ld (ix+0x09),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x1225, 6); // inc hl

  regs.a = mem.read8(regs.hl); // HL exits at source+5
  m.step(0x1226, 7); // ld a,(hl)
  mem.write8((regs.ix + 0x0a) & 0xffff, regs.a);
  m.step(0x1229, 19); // ld (ix+0x0a),a

  m.ret(); // 1229
}
