// SPDX-License-Identifier: GPL-3.0-only

// loc_0552  (ROM 0x0552-0x059c) -- idx4: reset a 3-byte counter triple, then render it as tiles.
// A (0,1,>=2) selects a counter base (0x88a2/0x88a5/0x88a8); the routine zeroes base..base+2, then
// restores A and selects the source pointer (0x88a4/0x88a7/0x88aa = base+2) and dest sprite column
// (IX 0x8781/0x8521/0x8641). For B=3 bytes read downward it splits each into two BCD nibbles
// (high via rrca x4, low direct) and calls the digit emitter 0x059d for each. C=4 is the leading-
// zero-suppression run length consumed by 0x059d. The two `call 0x059d` model the push of the
// return address (0x0595 / 0x0599) exactly as the hardware CALL does.
export function loc_0552(m) {
  const { regs, mem } = m;

  m.push16(regs.af);                 m.step(0x0553, 11);
  regs.hl = 0x88a2;                  m.step(0x0556, 10);
  regs.and(regs.a);                  m.step(0x0557, 4);
  if (regs.fZ) {
    m.step(0x0562, 12);              // jr z,0x0562 taken (A==0)
  } else {
    m.step(0x0559, 7);               // jr z not taken
    regs.hl = 0x88a5;                m.step(0x055c, 10);
    regs.a = regs.dec8(regs.a);      m.step(0x055d, 4);
    if (regs.fZ) {
      m.step(0x0562, 12);            // jr z,0x0562 taken (A==1)
    } else {
      m.step(0x055f, 7);             // jr z not taken (A>=2)
      regs.hl = 0x88a8;              m.step(0x0562, 10);
    }
  }

  // loc_0562: zero base..base+2
  mem.write8(regs.hl, 0x00);         m.step(0x0564, 10);
  regs.hl = (regs.hl + 1) & 0xffff;  m.step(0x0565, 6);
  mem.write8(regs.hl, 0x00);         m.step(0x0567, 10);
  regs.hl = (regs.hl + 1) & 0xffff;  m.step(0x0568, 6);
  mem.write8(regs.hl, 0x00);         m.step(0x056a, 10);
  regs.af = m.pop16();               m.step(0x056b, 10); // restore original A
  regs.hl = 0x88a4;                  m.step(0x056e, 10);
  regs.ix = 0x8781;                  m.step(0x0572, 14);
  regs.and(regs.a);                  m.step(0x0573, 4);
  if (regs.fZ) {
    m.step(0x0586, 12);              // jr z,0x0586 taken (A==0)
  } else {
    m.step(0x0575, 7);               // jr z not taken
    regs.hl = 0x88a7;                m.step(0x0578, 10);
    regs.ix = 0x8521;                m.step(0x057c, 14);
    regs.a = regs.dec8(regs.a);      m.step(0x057d, 4);
    if (regs.fZ) {
      m.step(0x0586, 12);            // jr z,0x0586 taken (A==1)
    } else {
      m.step(0x057f, 7);             // jr z not taken (A>=2)
      regs.hl = 0x88aa;              m.step(0x0582, 10);
      regs.ix = 0x8641;              m.step(0x0586, 14);
    }
  }

  // loc_0586: emit 3 bytes (each -> high nibble then low nibble) via 0x059d
  regs.de = 0xffe0;                  m.step(0x0589, 10);
  regs.b = 0x03;                     m.step(0x058b, 7);
  regs.c = 0x04;                     m.step(0x058d, 7);

  for (;;) { // loc_058d
    regs.a = mem.read8(regs.hl);     m.step(0x058e, 7);
    regs.rrca();                     m.step(0x058f, 4);
    regs.rrca();                     m.step(0x0590, 4);
    regs.rrca();                     m.step(0x0591, 4);
    regs.rrca();                     m.step(0x0592, 4);
    m.push16(0x0595);                                    // 0592 call: push return addr
    m.step(0x059d, 17);
    m.call(0x059d);                                      // high nibble
    regs.a = mem.read8(regs.hl);     m.step(0x0596, 7);
    m.push16(0x0599);                                    // 0596 call: push return addr
    m.step(0x059d, 17);
    m.call(0x059d);                                      // low nibble
    regs.hl = (regs.hl - 1) & 0xffff; m.step(0x059a, 6);
    if (regs.djnz() !== 0) { m.step(0x058d, 13); continue; } // 059a djnz 0x058d
    m.step(0x059c, 8);
    break;
  }
  m.ret(10); // 059c ret
}
