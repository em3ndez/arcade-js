// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4eea  (ROM 0x4eea-0x4f25, The Pit) -- action dispatcher on the control-bits
 * byte at 0x8018 for a two-cell (vertically stacked) object. It reads 0x8018 into A
 * and tests bits 0..4 IN ORDER, first-match-wins:
 *
 *   - bit0 set -> TAIL-jump to loc_4f26 (step the C "column" DOWN: dec c, with the
 *                 0xfe->0x23 wrap and the 0x09 lower clamp, +sound-request 8)
 *   - bit1 set -> TAIL-jump to loc_4f38 (step C UP: inc c, 0x00->0x0a wrap, 0x23
 *                 upper clamp, +sound-request 8)
 *   - bit2 set -> TAIL-jump to loc_4f26  (same as bit0)
 *   - bit3 set -> TAIL-jump to loc_4f38  (same as bit1)
 *   - bit4 set -> fall into the COMMIT body below
 *   - none of bits 0..4 set -> `ret z` (do nothing this frame)
 *
 * The COMMIT body (bit4) erases the object's two current cells ((hl):=C and
 * (ix+0):=C -- C is the caller's blank/erase tile code), copies the object code
 * A:=B, then moves the (hl) and (de) pointers UP one 0x20-byte tilemap row (bc set
 * to 0xffe0 = -0x20; `add hl,bc` on hl, and again on de via the ex-de-hl sandwich),
 * bumps ix by one, sets C:=0x0a, redraws the object code (A, i.e. old B) at the new
 * (de), decrements the counter at 0x804b, clears 0x8010, calls loc_4c8f, loads
 * A:=0x14 and TAIL-jumps to loc_4bff (arm a 20-frame vblank delay). Role is
 * best-effort; addresses, flags, cycle costs and control flow are EXACT, one JS
 * statement per Z80 instruction.
 *
 * CONTROL-FLOW MODELLING (the translation doc): the four `jr nz` land on sibling routines
 * loc_4f26 / loc_4f38, each of which ends in its own `ret` that unwinds to OUR
 * caller -- so each taken branch is a conditional TAIL-jump: `m.step(target,12);
 * return m.call(target)` with NO trailing m.ret (a second ret would double-pop).
 * The final `jp 0x4bff` is the same shape. The `ret z` is the ordinary conditional
 * return (`m.ret(11)` taken / `m.step(0x4f00,5)` not). The mid-body `call 0x4c8f`
 * DOES push its own return address (0x4f21) and control resumes here afterwards.
 * `bit n,a` uses the register form (Z = !bit n; A and carry unaffected).
 *
 * loc_4eea:
 *   4eea  3a 18 80     ld   a,(0x8018)      ; control/action bits
 *   4eed  cb 47        bit  0,a
 *   4eef  20 35        jr   nz,0x4f26       ; bit0 -> step down
 *   4ef1  cb 4f        bit  1,a
 *   4ef3  20 43        jr   nz,0x4f38       ; bit1 -> step up
 *   4ef5  cb 57        bit  2,a
 *   4ef7  20 2d        jr   nz,0x4f26       ; bit2 -> step down
 *   4ef9  cb 5f        bit  3,a
 *   4efb  20 3b        jr   nz,0x4f38       ; bit3 -> step up
 *   4efd  cb 67        bit  4,a
 *   4eff  c8           ret  z               ; none of bits 0..4 -> idle
 *   4f00  71           ld   (hl),c          ; erase current top cell
 *   4f01  dd 71 00     ld   (ix+0x00),c     ; erase current bottom cell
 *   4f04  78           ld   a,b             ; A = object code
 *   4f05  01 e0 ff     ld   bc,0xffe0       ; BC = -0x20 (one tilemap row up)
 *   4f08  09           add  hl,bc           ; hl -= 0x20
 *   4f09  eb           ex   de,hl
 *   4f0a  09           add  hl,bc           ; de -= 0x20 (while swapped in)
 *   4f0b  eb           ex   de,hl
 *   4f0c  dd 23        inc  ix
 *   4f0e  0e 0a        ld   c,0x0a
 *   4f10  12           ld   (de),a          ; redraw object code one row up
 *   4f11  47           ld   b,a
 *   4f12  3a 4b 80     ld   a,(0x804b)
 *   4f15  3d           dec  a
 *   4f16  32 4b 80     ld   (0x804b),a      ; decrement counter
 *   4f19  3e 00        ld   a,0x00
 *   4f1b  32 10 80     ld   (0x8010),a      ; clear 0x8010
 *   4f1e  cd 8f 4c     call 0x4c8f
 *   4f21  3e 14        ld   a,0x14
 *   4f23  c3 ff 4b     jp   0x4bff          ; arm a 20-frame vblank delay (tail)
 */
export function loc_4eea(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8018); // 4eea  ld a,(0x8018) -- control/action bits
  m.step(0x4eed, 13);
  regs.bit(0, regs.a); // 4eed  bit 0,a (Z = !bit0; A untouched)
  m.step(0x4eef, 8);
  if (regs.fNZ) { m.step(0x4f26, 12); return m.call(0x4f26); } // 4eef  jr nz,0x4f26 -- bit0 -> loc_4f26 (tail)
  m.step(0x4ef1, 7); // 4eef  jr nz not taken

  regs.bit(1, regs.a); // 4ef1  bit 1,a
  m.step(0x4ef3, 8);
  if (regs.fNZ) { m.step(0x4f38, 12); return m.call(0x4f38); } // 4ef3  jr nz,0x4f38 -- bit1 -> loc_4f38 (tail)
  m.step(0x4ef5, 7); // 4ef3  jr nz not taken

  regs.bit(2, regs.a); // 4ef5  bit 2,a
  m.step(0x4ef7, 8);
  if (regs.fNZ) { m.step(0x4f26, 12); return m.call(0x4f26); } // 4ef7  jr nz,0x4f26 -- bit2 -> loc_4f26 (tail)
  m.step(0x4ef9, 7); // 4ef7  jr nz not taken

  regs.bit(3, regs.a); // 4ef9  bit 3,a
  m.step(0x4efb, 8);
  if (regs.fNZ) { m.step(0x4f38, 12); return m.call(0x4f38); } // 4efb  jr nz,0x4f38 -- bit3 -> loc_4f38 (tail)
  m.step(0x4efd, 7); // 4efb  jr nz not taken

  regs.bit(4, regs.a); // 4efd  bit 4,a (Z = !bit4)
  m.step(0x4eff, 8);
  if (regs.fZ) { m.ret(11); return; } // 4eff  ret z -- bits 0..4 all clear -> idle return
  m.step(0x4f00, 5); // 4eff  ret z not taken (bit4 set -> commit)

  mem.write8(regs.hl, regs.c); // 4f00  ld (hl),c -- erase current top cell
  m.step(0x4f01, 7);
  mem.write8((regs.ix + 0x00) & 0xffff, regs.c); // 4f01  ld (ix+0x00),c -- erase current bottom cell
  m.step(0x4f04, 19);
  regs.a = regs.b; // 4f04  ld a,b -- A = object code
  m.step(0x4f05, 4);
  regs.bc = 0xffe0; // 4f05  ld bc,0xffe0 -- -0x20 (one tilemap row up)
  m.step(0x4f08, 10);
  regs.addHl(regs.bc); // 4f08  add hl,bc -- hl -= 0x20
  m.step(0x4f09, 11);
  regs.exDeHl(); // 4f09  ex de,hl
  m.step(0x4f0a, 4);
  regs.addHl(regs.bc); // 4f0a  add hl,bc -- (old de) -= 0x20 while swapped in
  m.step(0x4f0b, 11);
  regs.exDeHl(); // 4f0b  ex de,hl -- swap back
  m.step(0x4f0c, 4);
  regs.ix = (regs.ix + 1) & 0xffff; // 4f0c  inc ix (no flags)
  m.step(0x4f0e, 10);
  regs.c = 0x0a; // 4f0e  ld c,0x0a
  m.step(0x4f10, 7);
  mem.write8(regs.de, regs.a); // 4f10  ld (de),a -- redraw object code one row up
  m.step(0x4f11, 7);
  regs.b = regs.a; // 4f11  ld b,a
  m.step(0x4f12, 4);
  regs.a = mem.read8(0x804b); // 4f12  ld a,(0x804b)
  m.step(0x4f15, 13);
  regs.a = regs.dec8(regs.a); // 4f15  dec a
  m.step(0x4f16, 4);
  mem.write8(0x804b, regs.a); // 4f16  ld (0x804b),a -- decrement counter
  m.step(0x4f19, 13);
  regs.a = 0x00; // 4f19  ld a,0x00
  m.step(0x4f1b, 7);
  mem.write8(0x8010, regs.a); // 4f1b  ld (0x8010),a -- clear 0x8010
  m.step(0x4f1e, 13);
  m.push16(0x4f21); m.step(0x4c8f, 17); m.call(0x4c8f); // 4f1e  call 0x4c8f (pushes 0x4f21, resumes here)
  regs.a = 0x14; // 4f21  ld a,0x14 -- 20-frame delay
  m.step(0x4f23, 7);
  m.step(0x4bff, 10); // 4f23  jp 0x4bff
  return m.call(0x4bff); // loc_4bff's ret unwinds to loc_4eea's caller (tail; no m.ret)
}
