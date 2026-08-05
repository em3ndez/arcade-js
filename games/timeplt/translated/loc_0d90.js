// SPDX-License-Identifier: GPL-3.0-only

// loc_0d90  (ROM 0x0D90-0x0D9F, Time Pilot)
export function loc_0d90(m) {
  const { regs, mem } = m;

  regs.and(0x0f);
  m.step(0x0d92, 7); // and 0x0f
  m.push16(regs.hl);
  m.step(0x0d93, 11); // push hl -- rst 0x08 clobbers it
  regs.hl = 0x0dcc;
  m.step(0x0d96, 10); // ld hl,0x0dcc -- the character-code table

  m.push16(0x0d97);
  m.step(0x0008, 11); // rst 0x08 -- A = (HL + A)
  m.call(0x0008);

  regs.hl = m.pop16();
  m.step(0x0d98, 10); // pop hl
  mem.write8(regs.de, regs.a);
  m.step(0x0d99, 7); // ld (de),a -- tile code
  regs.d = regs.res(2, regs.d); // res/set touch NO flags
  m.step(0x0d9b, 8); // res 2,d -- 0xA4xx -> 0xA0xx (colour plane)
  regs.a = regs.c;
  m.step(0x0d9c, 4); // ld a,c
  mem.write8(regs.de, regs.a);
  m.step(0x0d9d, 7); // ld (de),a -- attribute byte
  regs.d = regs.set(2, regs.d);
  m.step(0x0d9f, 8); // set 2,d -- restore the video-RAM pointer
  m.ret(10); // ret
}
