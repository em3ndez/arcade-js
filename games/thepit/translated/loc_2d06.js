// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2d06  (ROM 0x2d06-0x2d4b, The Pit) -- advances the target object's Y by one
 * (0x80ac += 1), derives its tile cell in video RAM from the target X/Y at
 * 0x80a9/0x80ac, then probes the tile at a fixed -0x1e offset from that cell and
 * three-way dispatches on it. Reached as a tail-jump from loc_2cb7 (the capture
 * "already-done"/window-miss paths).
 *
 * Address arithmetic (exact; the geometric role labels are best-effort from the code):
 *   - a = (0x80a9) >> 3        ; target X to a tile column
 *   - a = 0x1f - (X>>3)        ; neg + add 0x1f: column measured from the right edge -> h
 *   - a = (0x80ac); (0x80ac) = a+1 ; advance the target Y and store it back
 *   - e = a+1 (= Y+2); c = (Y+2) >> 3, b = 0   ; bc = tile row
 *   - three `srl h / rra` pairs shift h's low 3 bits down into the top of a -> l
 *   - hl = hl + bc + 0x9000    ; combine column/row with the video-RAM base 0x9000
 *   - (0x80af) = hl; ix = (0x80af)             ; stash + reload into ix
 *   - a = (ix-0x1e)            ; the probed tile
 *       a == 0x2a -> jr z  loc_2d4e   ; TAIL-JUMP
 *       a == 0x2b -> jr z  loc_2d4e   ; TAIL-JUMP
 *       a != 0x41 -> jp nz loc_2bd3   ; TAIL-JUMP (else fall through to loc_2d4e, a == 0x41)
 *
 * loc_2d4e and loc_2bd3 are separate routines; loc_2d06 keeps no frame of its own, so
 * each exit is a TAIL-JUMP -- the callee's own `ret` returns to loc_2d06's caller.
 * Modelled `m.step(target, T); return m.call(target)` with NO trailing m.ret (a second
 * ret would double-pop). The `jp nz` NOT-taken fall-through into loc_2d4e is likewise a
 * delegation into that routine (0x2d4e is a labelled boundary, not inlined here).
 *
 * `ld (0x80ac),a` (0x2d19) touches no flags, so nothing between the address math and the
 * tile compares depends on it; the branch senses read the `cp` flags directly.
 *
 *   2d06  3a a9 80     ld   a,(0x80a9)
 *   2d09  cb 3f        srl  a
 *   2d0b  cb 3f        srl  a
 *   2d0d  cb 3f        srl  a
 *   2d0f  ed 44        neg
 *   2d11  c6 1f        add  a,0x1f
 *   2d13  67           ld   h,a
 *   2d14  3a ac 80     ld   a,(0x80ac)
 *   2d17  c6 01        add  a,0x01
 *   2d19  32 ac 80     ld   (0x80ac),a
 *   2d1c  3c           inc  a
 *   2d1d  5f           ld   e,a
 *   2d1e  cb 3f        srl  a
 *   2d20  cb 3f        srl  a
 *   2d22  cb 3f        srl  a
 *   2d24  4f           ld   c,a
 *   2d25  3e 00        ld   a,0x00
 *   2d27  47           ld   b,a
 *   2d28  cb 3c        srl  h
 *   2d2a  1f           rra
 *   2d2b  cb 3c        srl  h
 *   2d2d  1f           rra
 *   2d2e  cb 3c        srl  h
 *   2d30  1f           rra
 *   2d31  6f           ld   l,a
 *   2d32  09           add  hl,bc
 *   2d33  01 00 90     ld   bc,0x9000
 *   2d36  09           add  hl,bc
 *   2d37  22 af 80     ld   (0x80af),hl
 *   2d3a  dd 2a af 80  ld   ix,(0x80af)
 *   2d3e  dd 7e e2     ld   a,(ix-0x1e)
 *   2d41  fe 2a        cp   0x2a
 *   2d43  28 09        jr   z,0x2d4e
 *   2d45  fe 2b        cp   0x2b
 *   2d47  28 05        jr   z,0x2d4e
 *   2d49  fe 41        cp   0x41
 *   2d4b  c2 d3 2b     jp   nz,0x2bd3
 */
export function loc_2d06(m) {
  const { regs, mem } = m;

  // 2d06  ld a,(0x80a9) -- target X (pixel)
  regs.a = mem.read8(0x80a9);
  m.step(0x2d09, 13);
  // 2d09  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x2d0b, 8);
  // 2d0b  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x2d0d, 8);
  // 2d0d  srl a -- a = X >> 3 (tile column)
  regs.a = regs.srl(regs.a);
  m.step(0x2d0f, 8);
  // 2d0f  neg
  regs.neg();
  m.step(0x2d11, 8);
  // 2d11  add a,0x1f -- a = 0x1f - (X>>3): column measured from the right edge
  regs.add(0x1f);
  m.step(0x2d13, 7);
  // 2d13  ld h,a
  regs.h = regs.a;
  m.step(0x2d14, 4);
  // 2d14  ld a,(0x80ac) -- target Y (pixel)
  regs.a = mem.read8(0x80ac);
  m.step(0x2d17, 13);
  // 2d17  add a,0x01 -- advance Y by one
  regs.add(0x01);
  m.step(0x2d19, 7);
  // 2d19  ld (0x80ac),a -- store the advanced Y back (touches no flags)
  mem.write8(0x80ac, regs.a);
  m.step(0x2d1c, 13);
  // 2d1c  inc a -- a = Y+2
  regs.a = regs.inc8(regs.a);
  m.step(0x2d1d, 4);
  // 2d1d  ld e,a
  regs.e = regs.a;
  m.step(0x2d1e, 4);
  // 2d1e  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x2d20, 8);
  // 2d20  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x2d22, 8);
  // 2d22  srl a -- a = (Y+2) >> 3 (tile row)
  regs.a = regs.srl(regs.a);
  m.step(0x2d24, 8);
  // 2d24  ld c,a
  regs.c = regs.a;
  m.step(0x2d25, 4);
  // 2d25  ld a,0x00
  regs.a = 0x00;
  m.step(0x2d27, 7);
  // 2d27  ld b,a -- bc = (Y+2) >> 3 (tile row)
  regs.b = regs.a;
  m.step(0x2d28, 4);
  // 2d28  srl h -- bit 0 of h -> carry
  regs.h = regs.srl(regs.h);
  m.step(0x2d2a, 8);
  // 2d2a  rra -- carry -> bit 7 of a
  regs.rra();
  m.step(0x2d2b, 4);
  // 2d2b  srl h
  regs.h = regs.srl(regs.h);
  m.step(0x2d2d, 8);
  // 2d2d  rra
  regs.rra();
  m.step(0x2d2e, 4);
  // 2d2e  srl h
  regs.h = regs.srl(regs.h);
  m.step(0x2d30, 8);
  // 2d30  rra -- three srl/rra pairs shift h's low 3 bits down into the top of a
  regs.rra();
  m.step(0x2d31, 4);
  // 2d31  ld l,a
  regs.l = regs.a;
  m.step(0x2d32, 4);
  // 2d32  add hl,bc -- fold in the tile row
  regs.addHl(regs.bc);
  m.step(0x2d33, 11);
  // 2d33  ld bc,0x9000 -- video-RAM base
  regs.bc = 0x9000;
  m.step(0x2d36, 10);
  // 2d36  add hl,bc -- hl = video-RAM tile cell
  regs.addHl(regs.bc);
  m.step(0x2d37, 11);
  // 2d37  ld (0x80af),hl -- stash the computed cell address
  mem.write16(0x80af, regs.hl);
  m.step(0x2d3a, 16);
  // 2d3a  ld ix,(0x80af) -- reload it into ix for indexed access
  regs.ix = mem.read16(0x80af);
  m.step(0x2d3e, 20);
  // 2d3e  ld a,(ix-0x1e) -- the probed tile, a fixed offset from the cell
  regs.a = mem.read8((regs.ix - 0x1e) & 0xffff);
  m.step(0x2d41, 19);
  // 2d41  cp 0x2a
  regs.cp(0x2a);
  m.step(0x2d43, 7);
  // 2d43  jr z,0x2d4e -- tile 0x2a -> tail-jump to loc_2d4e
  if (regs.fZ) {
    m.step(0x2d4e, 12);
    return m.call(0x2d4e);
  }
  m.step(0x2d45, 7); // jr z NOT taken = 7 T
  // 2d45  cp 0x2b
  regs.cp(0x2b);
  m.step(0x2d47, 7);
  // 2d47  jr z,0x2d4e -- tile 0x2b -> tail-jump to loc_2d4e
  if (regs.fZ) {
    m.step(0x2d4e, 12);
    return m.call(0x2d4e);
  }
  m.step(0x2d49, 7); // jr z NOT taken = 7 T
  // 2d49  cp 0x41
  regs.cp(0x41);
  m.step(0x2d4b, 7);
  // 2d4b  jp nz,0x2bd3 -- tile is none of 0x2a/0x2b/0x41 -> tail-jump to loc_2bd3
  if (regs.fNZ) {
    m.step(0x2bd3, 10);
    return m.call(0x2bd3);
  }
  // fall-through (tile == 0x41): jp nz NOT taken still costs 10 T, then delegate into loc_2d4e
  m.step(0x2d4e, 10);
  return m.call(0x2d4e);
}
