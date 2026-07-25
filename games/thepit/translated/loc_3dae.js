// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3dae  (ROM 0x3dae-0x3dc8) — row -> screen offset: converts the row byte
 * at 0x8059 into a 16-bit tilemap offset and stores it at 0x805a.
 *
 *   3dae  3a 59 80     ld   a,(0x8059)
 *   3db1  67           ld   h,a
 *   3db2  3e 00        ld   a,0x00
 *   3db4  cb 3c        srl  h
 *   3db6  1f           rra
 *   3db7  cb 3c        srl  h
 *   3db9  1f           rra
 *   3dba  cb 3c        srl  h
 *   3dbc  1f           rra
 *   3dbd  6f           ld   l,a
 *   3dbe  3a 58 80     ld   a,(0x8058)
 *   3dc1  4f           ld   c,a
 *   3dc2  06 00        ld   b,0x00
 *   3dc4  09           add  hl,bc
 *   3dc5  22 5a 80     ld   (0x805a),hl
 *   3dc8  c9           ret
 *
 * The three `srl h` / `rra` pairs form a 16-bit shift: each `srl h` drops h's
 * low bit into carry, and `rra` rotates that carry into A's top bit. Starting
 * from h=v, a=0, after three rounds h = v>>3 and a = (v&7)<<5, so HL = (v>>3)*256
 * + (v&7)*32 = v*32 — the byte at 0x8059 scaled by the 0x20 (=32) row stride.
 * `add hl,bc` then adds the column byte at 0x8058 (zero-extended: b:=0, c:=col),
 * giving HL = 32*row + col, which is stored at 0x805a. `add hl,bc` sets H/N/C
 * (F3/F5 from the result high byte) and preserves the S/Z/PV the last `srl h`
 * left; no code here reads those, but they are the routine's exit flags.
 */
export function loc_3dae(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8059);
  m.step(0x3db1, 13); // ld a,(0x8059) -- the row byte
  regs.h = regs.a;
  m.step(0x3db2, 4); // ld h,a
  regs.a = 0x00;
  m.step(0x3db4, 7); // ld a,0x00 -- A accumulates the shifted-out low bits
  regs.h = regs.srl(regs.h);
  m.step(0x3db6, 8); // srl h -- h.0 -> carry
  regs.rra();
  m.step(0x3db7, 4); // rra -- carry -> a.7
  regs.h = regs.srl(regs.h);
  m.step(0x3db9, 8); // srl h
  regs.rra();
  m.step(0x3dba, 4); // rra
  regs.h = regs.srl(regs.h);
  m.step(0x3dbc, 8); // srl h
  regs.rra();
  m.step(0x3dbd, 4); // rra -- HL now = v*32
  regs.l = regs.a;
  m.step(0x3dbe, 4); // ld l,a
  regs.a = mem.read8(0x8058);
  m.step(0x3dc1, 13); // ld a,(0x8058) -- the column byte
  regs.c = regs.a;
  m.step(0x3dc2, 4); // ld c,a
  regs.b = 0x00;
  m.step(0x3dc4, 7); // ld b,0x00 -- BC = column, zero-extended
  regs.addHl(regs.bc); // HL = 32*row + col; sets H/N/C (unread here)
  m.step(0x3dc5, 11); // add hl,bc
  mem.write16(0x805a, regs.hl);
  m.step(0x3dc8, 16); // ld (0x805a),hl
  m.ret(); // ret
}
