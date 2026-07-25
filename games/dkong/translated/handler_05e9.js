// SPDX-License-Identifier: GPL-3.0-only

/**
 * handler_05e9  (ROM 0x05E9–0x0610) — task table entry 3: draw a string.
 *
 *   05e9  21 4b 36     ld   hl,0x364b
 *   05ec  87           add  a,a
 *   05ed  f5           push af
 *   05ee  e6 7f        and  0x7f
 *   05f0  5f           ld   e,a
 *   05f1  16 00        ld   d,0x00
 *   05f3  19           add  hl,de
 *   05f4  5e           ld   e,(hl)
 *   05f5  23           inc  hl
 *   05f6  56           ld   d,(hl)
 *   05f7  eb           ex   de,hl
 *   05f8  5e           ld   e,(hl)
 *   05f9  23           inc  hl
 *   05fa  56           ld   d,(hl)
 *   05fb  23           inc  hl
 *   05fc  01 e0 ff     ld   bc,0xffe0
 *   05ff  eb           ex   de,hl
 *   0600  1a           ld   a,(de)           ; loop
 *   0601  fe 3f        cp   0x3f
 *   0603  ca 26 00     jp   z,0x0026
 *   0606  77           ld   (hl),a
 *   0607  f1           pop  af
 *   0608  30 02        jr   nc,0x060c
 *   060a  36 10        ld   (hl),0x10
 *   060c  f5           push af
 *   060d  13           inc  de
 *   060e  09           add  hl,bc
 *   060f  18 ef        jr   0x0600
 *
 * A doubly-indirected string draw. The payload indexes a pointer table at
 * 0x364B; that entry points to a descriptor holding the VRAM destination,
 * and the bytes after it are the characters. BC = 0xFFE0 steps the
 * destination back one tilemap row per character, so the string is drawn
 * VERTICALLY -- which is what you would expect on a screen the hardware
 * rotates 270 degrees.
 *
 * 0x3F is the terminator, and the exit is `jp z,0x0026` -- a jump into the
 * TAIL of sub_0020 (`pop hl / ret`), a shared skip-return that discards this
 * handler's return address and returns to its caller's caller. A fourth
 * distinct stack idiom, and this one is a jump into another routine's middle
 * rather than a call.
 *
 * The `push af` / `pop af` pair carries the carry from `add a,a` across the
 * loop: bit 7 of the payload decides whether each character is followed by a
 * blank (tile 0x10).
 */
export function handler_05e9(m) {
  const { regs, mem } = m;

  regs.hl = 0x364b;
  m.step(0x05ec, 10);
  regs.add(regs.a); // add a,a -- bit 7 into carry
  m.step(0x05ed, 4);
  m.push16(regs.af);
  m.step(0x05ee, 11);
  regs.and(0x7f);
  m.step(0x05f0, 7);
  regs.e = regs.a;
  m.step(0x05f1, 4);
  regs.d = 0x00;
  m.step(0x05f3, 7);
  regs.addHl(regs.de);
  m.step(0x05f4, 11);
  regs.e = mem.read8(regs.hl);
  m.step(0x05f5, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x05f6, 6);
  regs.d = mem.read8(regs.hl);
  m.step(0x05f7, 7);
  regs.exDeHl();
  m.step(0x05f8, 4);
  regs.e = mem.read8(regs.hl);
  m.step(0x05f9, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x05fa, 6);
  regs.d = mem.read8(regs.hl);
  m.step(0x05fb, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x05fc, 6);
  regs.bc = 0xffe0; // -32: one tilemap row per character
  m.step(0x05ff, 10);
  regs.exDeHl();
  m.step(0x0600, 4);

  for (;;) {
    regs.a = mem.read8(regs.de);
    m.step(0x0601, 7);
    regs.cp(0x3f);
    m.step(0x0603, 7);
    if (regs.fZ) {
      // 0x3F terminator -> jp z,0x0026, REUSING sub_0020's `pop hl / ret` tail.
      // This is NOT a caller-skip here (despite borrowing that code): at this
      // point the stack is [return-addr, AF], because the `push af` @0x05EE is
      // still outstanding -- the loop's balancing `pop af` @0x0608 is AFTER this
      // cp/jp-z check. So `pop hl` discards THAT push-af value (not the return
      // address), and `ret` goes to the IMMEDIATE caller. A NORMAL return.
      // (The `pop hl` is load-bearing: remove it and callers return one frame
      // short.)
      m.step(0x0026, 10);
      regs.hl = m.pop16(); // discards the outstanding push-af, NOT the return addr
      m.step(0x0027, 10);
      m.ret(); // -> the immediate caller (normal return)
      return;
    }
    m.step(0x0606, 10);
    mem.write8(regs.hl, regs.a);
    m.step(0x0607, 7);
    regs.af = m.pop16();
    m.step(0x0608, 10);
    if (regs.fNC) {
      m.step(0x060c, 12); // jr nc taken -- no trailing blank
    } else {
      m.step(0x060a, 7);
      mem.write8(regs.hl, 0x10);
      m.step(0x060c, 10);
    }
    m.push16(regs.af);
    m.step(0x060d, 11);
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x060e, 6);
    regs.addHl(regs.bc);
    m.step(0x060f, 11);
    m.step(0x0600, 12); // jr 0x0600
  }
}
