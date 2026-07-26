// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2cb7  (ROM 0x2cb7-0x2d05, The Pit) -- per-tick handler for the timed/tracked
 * object that shares the record + overlap tails with loc_2c04. Clears the per-tick
 * flag 0x8080, then advances the countdown byte 0x80b1 and, when it expires, runs a
 * two-axis "capture window" test between the tracked object bytes 0x8068/0x806b and the
 * target bytes 0x80a9/0x80ac.
 *
 * Control flow (addresses, arithmetic and branch senses exact; the role labels are
 * best-effort from the code):
 *   - 0x8080 = 0                         ; clear the per-tick overlap/capture flag
 *   - a = (0x80b1); cp 0x40              ; countdown vs the reload sentinel 0x40
 *       == 0x40  -> jp z  0x2d6b         ; TAIL-JUMP to the reload/reset path
 *   - dec a; (0x80b1) = a                ; tick the countdown down, store it back
 *       != 0     -> jp nz 0x2c91         ; TAIL-JUMP into the overlap-record tail (shared
 *                                          with loc_2c04); the tick has not expired yet
 *   - expired (a == 0): (0x80b1) = 1     ; reload the countdown to 1
 *   - a = (0x80c1); and a                ; the "already captured" flag
 *       != 0     -> jr nz 0x2d06         ; TAIL-JUMP: nothing to do, already captured
 *   - window test A (row/0x80ac axis):   keep only if (0x80ac)+0x0a < (0x806b) <= (0x80ac)+0x0d
 *       (0x80ac)+0x0a >= (0x806b) -> jr nc 0x2d06   ; below the window -> out
 *       (0x80ac)+0x0d <  (0x806b) -> jr c  0x2d06   ; above the window -> out
 *   - window test B (X/0x80a9 axis):     keep only if (0x80a9)-0x04 < (0x8068) <= (0x80a9)+0x04
 *       (0x80a9)-0x04 >= (0x8068) -> jr nc 0x2d06
 *       (0x80a9)+0x04 <  (0x8068) -> jr c  0x2d06
 *   - CAPTURE: a is (0x80a9)+0x04 here; (0x8068) = a  ; snap the object X onto the target
 *   - (0x80c1) = 1                       ; raise the "captured" flag
 *   - call 0x4c9f                        ; leaf side effect (resumes in-line)
 *   - jp 0x2bd3                          ; TAIL-JUMP to build the 4-byte record + continue
 *
 * The five `jr` guards all target 0x2d06 and the `jp z`/`jp nz`/final `jp` all leave this
 * routine for good: loc_2cb7 keeps no frame of its own, so each is a TAIL-JUMP -- the
 * callee's own `ret` returns to loc_2cb7's caller. Modelled `m.step(target, T); return
 * m.call(target)` with NO trailing m.ret (a second ret would double-pop). The one regular
 * `call 0x4c9f` pushes its own return address (0x2d03) and resumes in-line.
 *
 * `dec a` (0x2cc4) preserves nothing the routine needs across the intervening
 * `ld (0x80b1),a` -- `ld (nn),a` touches no flags, so the `jp nz` at 0x2cc8 reads the
 * dec's Z, not the earlier `cp 0x40`.
 *
 *   2cb7  3e 00        ld   a,0x00
 *   2cb9  32 80 80     ld   (0x8080),a
 *   2cbc  3a b1 80     ld   a,(0x80b1)
 *   2cbf  fe 40        cp   0x40
 *   2cc1  ca 6b 2d     jp   z,0x2d6b
 *   2cc4  3d           dec  a
 *   2cc5  32 b1 80     ld   (0x80b1),a
 *   2cc8  c2 91 2c     jp   nz,0x2c91
 *   2ccb  3e 01        ld   a,0x01
 *   2ccd  32 b1 80     ld   (0x80b1),a
 *   2cd0  3a c1 80     ld   a,(0x80c1)
 *   2cd3  a7           and  a
 *   2cd4  20 30        jr   nz,0x2d06
 *   2cd6  3a 6b 80     ld   a,(0x806b)
 *   2cd9  47           ld   b,a
 *   2cda  3a ac 80     ld   a,(0x80ac)
 *   2cdd  c6 0a        add  a,0x0a
 *   2cdf  b8           cp   b
 *   2ce0  30 24        jr   nc,0x2d06
 *   2ce2  c6 03        add  a,0x03
 *   2ce4  b8           cp   b
 *   2ce5  38 1f        jr   c,0x2d06
 *   2ce7  3a 68 80     ld   a,(0x8068)
 *   2cea  4f           ld   c,a
 *   2ceb  3a a9 80     ld   a,(0x80a9)
 *   2cee  d6 04        sub  0x04
 *   2cf0  b9           cp   c
 *   2cf1  30 13        jr   nc,0x2d06
 *   2cf3  c6 08        add  a,0x08
 *   2cf5  b9           cp   c
 *   2cf6  38 0e        jr   c,0x2d06
 *   2cf8  32 68 80     ld   (0x8068),a
 *   2cfb  3e 01        ld   a,0x01
 *   2cfd  32 c1 80     ld   (0x80c1),a
 *   2d00  cd 9f 4c     call 0x4c9f
 *   2d03  c3 d3 2b     jp   0x2bd3
 */
export function loc_2cb7(m) {
  const { regs, mem } = m;

  // 2cb7  ld a,0x00
  regs.a = 0x00;
  m.step(0x2cb9, 7);
  // 2cb9  ld (0x8080),a -- clear the per-tick overlap/capture flag
  mem.write8(0x8080, regs.a);
  m.step(0x2cbc, 13);
  // 2cbc  ld a,(0x80b1) -- the countdown byte
  regs.a = mem.read8(0x80b1);
  m.step(0x2cbf, 13);
  // 2cbf  cp 0x40 -- has the countdown reached the reload sentinel?
  regs.cp(0x40);
  m.step(0x2cc1, 7);
  // 2cc1  jp z,0x2d6b -- yes: tail-jump to the 0x2d6b reload/reset path
  if (regs.fZ) {
    m.step(0x2d6b, 10);
    return m.call(0x2d6b);
  }
  m.step(0x2cc4, 10); // jp z NOT taken still costs 10 T
  // 2cc4  dec a -- otherwise tick the countdown down by one
  regs.a = regs.dec8(regs.a);
  m.step(0x2cc5, 4);
  // 2cc5  ld (0x80b1),a -- store it back (ld (nn),a preserves dec's Z)
  mem.write8(0x80b1, regs.a);
  m.step(0x2cc8, 13);
  // 2cc8  jp nz,0x2c91 -- not expired: tail-jump into the shared overlap-record tail
  if (regs.fNZ) {
    m.step(0x2c91, 10);
    return m.call(0x2c91);
  }
  m.step(0x2ccb, 10); // jp nz NOT taken still costs 10 T
  // 2ccb  ld a,0x01
  regs.a = 0x01;
  m.step(0x2ccd, 7);
  // 2ccd  ld (0x80b1),a -- expired: reload the countdown to 1
  mem.write8(0x80b1, regs.a);
  m.step(0x2cd0, 13);
  // 2cd0  ld a,(0x80c1) -- the "already captured" flag
  regs.a = mem.read8(0x80c1);
  m.step(0x2cd3, 13);
  // 2cd3  and a -- Z iff not yet captured
  regs.and(regs.a);
  m.step(0x2cd4, 4);
  // 2cd4  jr nz,0x2d06 -- already captured: tail-jump out
  if (regs.fNZ) {
    m.step(0x2d06, 12);
    return m.call(0x2d06);
  }
  m.step(0x2cd6, 7);
  // 2cd6  ld a,(0x806b)
  regs.a = mem.read8(0x806b);
  m.step(0x2cd9, 13);
  // 2cd9  ld b,a -- b = tracked object byte 0x806b
  regs.b = regs.a;
  m.step(0x2cda, 4);
  // 2cda  ld a,(0x80ac)
  regs.a = mem.read8(0x80ac);
  m.step(0x2cdd, 13);
  // 2cdd  add a,0x0a -- lower edge of window A
  regs.add(0x0a);
  m.step(0x2cdf, 7);
  // 2cdf  cp b
  regs.cp(regs.b);
  m.step(0x2ce0, 4);
  // 2ce0  jr nc,0x2d06 -- (0x80ac)+0x0a >= (0x806b): below the window -> out
  if (regs.fNC) {
    m.step(0x2d06, 12);
    return m.call(0x2d06);
  }
  m.step(0x2ce2, 7);
  // 2ce2  add a,0x03 -- a = (0x80ac)+0x0d, upper edge of window A
  regs.add(0x03);
  m.step(0x2ce4, 7);
  // 2ce4  cp b
  regs.cp(regs.b);
  m.step(0x2ce5, 4);
  // 2ce5  jr c,0x2d06 -- (0x80ac)+0x0d < (0x806b): above the window -> out
  if (regs.fC) {
    m.step(0x2d06, 12);
    return m.call(0x2d06);
  }
  m.step(0x2ce7, 7);
  // 2ce7  ld a,(0x8068)
  regs.a = mem.read8(0x8068);
  m.step(0x2cea, 13);
  // 2cea  ld c,a -- c = tracked object byte 0x8068
  regs.c = regs.a;
  m.step(0x2ceb, 4);
  // 2ceb  ld a,(0x80a9)
  regs.a = mem.read8(0x80a9);
  m.step(0x2cee, 13);
  // 2cee  sub 0x04 -- lower edge of window B
  regs.sub(0x04);
  m.step(0x2cf0, 7);
  // 2cf0  cp c
  regs.cp(regs.c);
  m.step(0x2cf1, 4);
  // 2cf1  jr nc,0x2d06 -- (0x80a9)-0x04 >= (0x8068): below the window -> out
  if (regs.fNC) {
    m.step(0x2d06, 12);
    return m.call(0x2d06);
  }
  m.step(0x2cf3, 7);
  // 2cf3  add a,0x08 -- a = (0x80a9)+0x04, upper edge of window B
  regs.add(0x08);
  m.step(0x2cf5, 7);
  // 2cf5  cp c
  regs.cp(regs.c);
  m.step(0x2cf6, 4);
  // 2cf6  jr c,0x2d06 -- (0x80a9)+0x04 < (0x8068): above the window -> out
  if (regs.fC) {
    m.step(0x2d06, 12);
    return m.call(0x2d06);
  }
  m.step(0x2cf8, 7);
  // 2cf8  ld (0x8068),a -- CAPTURE: snap the object X onto (0x80a9)+0x04
  mem.write8(0x8068, regs.a);
  m.step(0x2cfb, 13);
  // 2cfb  ld a,0x01
  regs.a = 0x01;
  m.step(0x2cfd, 7);
  // 2cfd  ld (0x80c1),a -- raise the "captured" flag
  mem.write8(0x80c1, regs.a);
  m.step(0x2d00, 13);
  // 2d00  call 0x4c9f -- leaf side effect; resumes in-line
  m.push16(0x2d03);
  m.step(0x4c9f, 17);
  m.call(0x4c9f);
  // 2d03  jp 0x2bd3 -- tail-jump: 0x2bd3's ret returns to loc_2cb7's caller
  m.step(0x2bd3, 10);
  return m.call(0x2bd3);
}
