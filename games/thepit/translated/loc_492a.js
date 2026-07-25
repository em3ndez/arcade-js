// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_492a  (ROM 0x492A–0x4945) — paints a 32-tile column into video RAM from the
 * ROM table at 0x49C7, then tail-jumps to loc_3e1d to colour that column.
 *
 *   492a  dd 21 c7 49  ld   ix,0x49c7      ; source: ROM tile table
 *   492e  21 f9 93     ld   hl,0x93f9      ; dest: video RAM, bottom of the column
 *   4931  11 e0 ff     ld   de,0xffe0      ; stride -0x20 (one row UP each write)
 *   4934  06 20        ld   b,0x20         ; 32 tiles -> B (djnz)
 *
 *   4936  dd 7e 00     ld   a,(ix+0x00)    ; loc_4936 -- djnz loop body
 *   4939  77           ld   (hl),a         ; store the tile
 *   493a  19           add  hl,de          ; HL -= 0x20 (H,N,C set; S/Z/PV kept)
 *   493b  dd 23        inc  ix             ; next source byte (no flags)
 *   493d  10 f7        djnz 0x4936
 *   493f  0e 02        ld   c,0x02         ; colour byte for loc_3e1d
 *   4941  3e 19        ld   a,0x19         ; column offset for loc_3e1d
 *   4943  c3 1d 3e     jp   0x3e1d         ; TAIL -> colour-RAM column fill
 *
 * The loop copies 32 bytes from 0x49C7..0x49E6 into video RAM at stride -0x20,
 * starting at 0x93F9 and walking UP the column to 0x9019; HL exits at 0x8FF9 (one
 * stride past the last write) and IX at 0x49E7. Every `add hl,de` sets H,N,C via
 * regs.addHl (the final carry-out escapes into the tail), while the 16-bit `inc ix`
 * touches no flags.
 *
 * The `jp 0x3e1d` is an unconditional TAIL-jump that pushes nothing, so it is
 * modelled as `return m.call(0x3e1d)`: loc_3e1d's own `ret` pops loc_492a's caller's
 * return address and lands one frame up, exactly as the discarded return address
 * demands. It is NOT `m.call; m.ret()` — that shape would push a spurious word onto
 * the diffed stack and charge a second ret's cycles (see loc_0000.js / loc_24cf.js).
 * A and C are the arguments loc_3e1d reads (A = column offset 0x19, C = fill 0x02).
 */
export function loc_492a(m) {
  const { regs, mem } = m;

  regs.ix = 0x49c7;
  m.step(0x492e, 14); // ld ix,0x49c7 -- source table
  regs.hl = 0x93f9;
  m.step(0x4931, 10); // ld hl,0x93f9 -- video RAM dest
  regs.de = 0xffe0;
  m.step(0x4934, 10); // ld de,0xffe0 -- stride -0x20
  regs.b = 0x20;
  m.step(0x4936, 7); // ld b,0x20 -- 32 tiles

  do {
    // loc_4936 -- djnz targets here.
    regs.a = mem.read8((regs.ix + 0x00) & 0xffff); // ld a,(ix+0x00)
    m.step(0x4939, 19);
    mem.write8(regs.hl, regs.a); // ld (hl),a -- store the tile
    m.step(0x493a, 7);
    regs.addHl(regs.de); // add hl,de -- HL -= 0x20; sets H,N,C
    m.step(0x493b, 11);
    regs.ix = (regs.ix + 1) & 0xffff; // inc ix -- 16-bit, no flags
    m.step(0x493d, 10);
    regs.djnz(); // dec b, no flags (that is why it is NOT dec8)
    m.step(regs.b !== 0 ? 0x4936 : 0x493f, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  regs.c = 0x02;
  m.step(0x4941, 7); // ld c,0x02 -- colour for loc_3e1d
  regs.a = 0x19;
  m.step(0x4943, 7); // ld a,0x19 -- column offset for loc_3e1d
  m.step(0x3e1d, 10); // jp 0x3e1d -- TAIL (discards no return of its own)
  return m.call(0x3e1d);
}
