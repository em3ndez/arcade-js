// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_186f  (ROM 0x186f-0x18ce, The Pit) -- from the actor's two position counters
 * (0x8068 vertical-ish, 0x806b horizontal-ish + the caller's D bias) it computes the
 * actor's on-screen video-RAM cell pointer, stashes the two grid coordinates at
 * 0x8073 / 0x8071, stores the pointer at 0x806e, reads the tile currently under the
 * actor and publishes it (0x80a5 / 0x80a7, clearing 0x80a8), then DISPATCHES on that
 * tile.
 *
 *   186f  3a 68 80     ld   a,(0x8068)      ; vertical position counter
 *   1872  c6 03        add  a,0x03          ; +3 bias
 *   1874  cb 3f        srl  a               ; >> 3 (three logical shifts) -> row cell
 *   1876  cb 3f        srl  a
 *   1878  cb 3f        srl  a
 *   187a  ed 44        neg                  ; screen row grows downward -> negate
 *   187c  c6 1f        add  a,0x1f          ; +0x1f -> row index 0..0x1f
 *   187e  32 73 80     ld   (0x8073),a      ; store row
 *   1881  67           ld   h,a             ; H = row (feeds the *0x20 build below)
 *   1882  3a 6b 80     ld   a,(0x806b)      ; horizontal position counter
 *   1885  82           add  a,d             ; + caller's D bias
 *   1886  c6 0c        add  a,0x0c          ; +0x0c bias
 *   1888  5f           ld   e,a             ; E = biased column (kept for the 0x53 test)
 *   1889  cb 3f        srl  a               ; >> 3 -> column cell
 *   188b  cb 3f        srl  a
 *   188d  cb 3f        srl  a
 *   188f  32 71 80     ld   (0x8071),a      ; store column
 *   1892  4f           ld   c,a             ; BC = column (low part of the offset)
 *   1893  3e 00        ld   a,0x00
 *   1895  47           ld   b,a             ; B = 0
 *   1896  cb 3c        srl  h               ; H:A >>= 1, three times: L = (row & 7)<<5,
 *   1898  1f           rra                  ;   H = row >> 3 -- i.e. HL = row * 0x20
 *   1899  cb 3c        srl  h
 *   189b  1f           rra
 *   189c  cb 3c        srl  h
 *   189e  1f           rra
 *   189f  6f           ld   l,a             ; L = low byte of row*0x20
 *   18a0  09           add  hl,bc           ; + column
 *   18a1  01 00 90     ld   bc,0x9000       ; video-RAM base
 *   18a4  09           add  hl,bc           ; -> absolute cell address
 *   18a5  22 6e 80     ld   (0x806e),hl     ; store the actor cell pointer
 *   18a8  dd 2a 6e 80  ld   ix,(0x806e)     ; IX = that pointer
 *   18ac  3e 00        ld   a,0x00
 *   18ae  32 a8 80     ld   (0x80a8),a      ; clear the next-tile slot
 *   18b1  dd 7e 00     ld   a,(ix+0x00)     ; tile currently under the actor
 *   18b4  32 a5 80     ld   (0x80a5),a      ; publish it (two copies)
 *   18b7  32 a7 80     ld   (0x80a7),a
 *   18ba  47           ld   b,a             ; keep tile in B
 *   18bb  fe 27        cp   0x27            ; is it the special 0x27 tile?
 *   18bd  20 10        jr   nz,0x18cf       ; no -> classify at loc_18cf
 *   18bf  32 e7 80     ld   (0x80e7),a      ; yes: latch 0x27 at 0x80e7
 *   18c2  3a 6b 80     ld   a,(0x806b)      ; horizontal position again
 *   18c5  fe 53        cp   0x53            ; past column 0x53?
 *   18c7  38 06        jr   c,0x18cf        ; not yet -> classify at loc_18cf
 *   18c9  32 77 80     ld   (0x8077),a      ; store the crossing position
 *   18cc  c3 d0 19     jp   0x19d0          ; -> loc_19d0
 *
 * CONTROL FLOW: the routine never executes a `ret` -- it always tail-jumps into a
 * sibling. `jr nz,0x18cf` (tile != 0x27) and `jr c,0x18cf` (0x806b < 0x53) both hand
 * off to loc_18cf; otherwise `jp 0x19d0` hands off to loc_19d0. Each is modelled per
 * doc 03 as `return m.call(0xTARGET)` with NO trailing m.ret -- the callee's own ret
 * unwinds to loc_186f's caller; a second ret would double-pop. loc_186a falls through
 * into here, so this is also the tail those thin frame-id prologues reach.
 *
 * FLAG NOTES: `ld b,a` (0x18ba) does not touch flags, so `cp 0x27` at 0x18bb drives
 * the `jr nz` at 0x18bd; likewise `ld a,(0x806b)` (0x18c2) is flag-neutral, so
 * `cp 0x53` at 0x18c5 drives the `jr c` at 0x18c7. The `neg`/`srl`/`rra` flag effects
 * are consumed only by the rotate/shift chain itself and by nothing conditional, so
 * they need no special handling beyond faithful computation. (Role read from the code;
 * the biases, store addresses, cycle charge and control flow are exact.)
 */
export function loc_186f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8068);
  m.step(0x1872, 13); // 186f  ld a,(0x8068) -- vertical position counter
  regs.add(0x03);
  m.step(0x1874, 7); // 1872  add a,0x03
  regs.a = regs.srl(regs.a);
  m.step(0x1876, 8); // 1874  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x1878, 8); // 1876  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x187a, 8); // 1878  srl a -- (pos+3) >> 3
  regs.neg();
  m.step(0x187c, 8); // 187a  neg -- row grows downward
  regs.add(0x1f);
  m.step(0x187e, 7); // 187c  add a,0x1f -- row index 0..0x1f
  mem.write8(0x8073, regs.a);
  m.step(0x1881, 13); // 187e  ld (0x8073),a -- store row
  regs.h = regs.a;
  m.step(0x1882, 4); // 1881  ld h,a -- H = row

  regs.a = mem.read8(0x806b);
  m.step(0x1885, 13); // 1882  ld a,(0x806b) -- horizontal position counter
  regs.add(regs.d);
  m.step(0x1886, 4); // 1885  add a,d -- + caller's D bias
  regs.add(0x0c);
  m.step(0x1888, 7); // 1886  add a,0x0c
  regs.e = regs.a;
  m.step(0x1889, 4); // 1888  ld e,a -- E = biased column
  regs.a = regs.srl(regs.a);
  m.step(0x188b, 8); // 1889  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x188d, 8); // 188b  srl a
  regs.a = regs.srl(regs.a);
  m.step(0x188f, 8); // 188d  srl a -- column cell
  mem.write8(0x8071, regs.a);
  m.step(0x1892, 13); // 188f  ld (0x8071),a -- store column
  regs.c = regs.a;
  m.step(0x1893, 4); // 1892  ld c,a
  regs.a = 0x00;
  m.step(0x1895, 7); // 1893  ld a,0x00
  regs.b = regs.a;
  m.step(0x1896, 4); // 1895  ld b,a -- BC = column

  regs.h = regs.srl(regs.h);
  m.step(0x1898, 8); // 1896  srl h
  regs.rra();
  m.step(0x1899, 4); // 1898  rra
  regs.h = regs.srl(regs.h);
  m.step(0x189b, 8); // 1899  srl h
  regs.rra();
  m.step(0x189c, 4); // 189b  rra
  regs.h = regs.srl(regs.h);
  m.step(0x189e, 8); // 189c  srl h
  regs.rra();
  m.step(0x189f, 4); // 189e  rra -- HL now = row * 0x20 (H:A shifted right 3)
  regs.l = regs.a;
  m.step(0x18a0, 4); // 189f  ld l,a
  regs.addHl(regs.bc);
  m.step(0x18a1, 11); // 18a0  add hl,bc -- + column
  regs.bc = 0x9000;
  m.step(0x18a4, 10); // 18a1  ld bc,0x9000 -- video-RAM base
  regs.addHl(regs.bc);
  m.step(0x18a5, 11); // 18a4  add hl,bc -- absolute cell address
  mem.write16(0x806e, regs.hl);
  m.step(0x18a8, 16); // 18a5  ld (0x806e),hl -- store the cell pointer
  regs.ix = mem.read16(0x806e);
  m.step(0x18ac, 20); // 18a8  ld ix,(0x806e)

  regs.a = 0x00;
  m.step(0x18ae, 7); // 18ac  ld a,0x00
  mem.write8(0x80a8, regs.a);
  m.step(0x18b1, 13); // 18ae  ld (0x80a8),a -- clear next-tile slot
  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x18b4, 19); // 18b1  ld a,(ix+0x00) -- tile under the actor
  mem.write8(0x80a5, regs.a);
  m.step(0x18b7, 13); // 18b4  ld (0x80a5),a
  mem.write8(0x80a7, regs.a);
  m.step(0x18ba, 13); // 18b7  ld (0x80a7),a
  regs.b = regs.a;
  m.step(0x18bb, 4); // 18ba  ld b,a -- keep tile in B
  regs.cp(0x27);
  m.step(0x18bd, 7); // 18bb  cp 0x27

  // 18bd  jr nz,0x18cf -- tile != 0x27 -> classify at loc_18cf (tail-jump)
  if (regs.fNZ) {
    m.step(0x18cf, 12);
    return m.call(0x18cf);
  }
  m.step(0x18bf, 7); // jr nz not taken -- tile == 0x27

  mem.write8(0x80e7, regs.a);
  m.step(0x18c2, 13); // 18bf  ld (0x80e7),a -- latch 0x27
  regs.a = mem.read8(0x806b);
  m.step(0x18c5, 13); // 18c2  ld a,(0x806b) -- horizontal position again
  regs.cp(0x53);
  m.step(0x18c7, 7); // 18c5  cp 0x53

  // 18c7  jr c,0x18cf -- 0x806b < 0x53 -> classify at loc_18cf (tail-jump)
  if (regs.fC) {
    m.step(0x18cf, 12);
    return m.call(0x18cf);
  }
  m.step(0x18c9, 7); // jr c not taken -- 0x806b >= 0x53

  mem.write8(0x8077, regs.a);
  m.step(0x18cc, 13); // 18c9  ld (0x8077),a -- store the crossing position
  m.step(0x19d0, 10); // 18cc  jp 0x19d0 -- tail-jump into loc_19d0
  return m.call(0x19d0);
}
