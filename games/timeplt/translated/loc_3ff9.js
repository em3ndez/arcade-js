// SPDX-License-Identifier: GPL-3.0-only

// loc_3ff9  (ROM 0x3FF9-0x4016, Time Pilot)
export function loc_3ff9(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;

  let label = 0x3ff9;
  for (;;) {
    switch (label) {
      case 0x3ff9:
        regs.a = mem.read8(X(0x00));
        m.step(0x3ffc, 19); // ld a,(ix+0x00)
        regs.and(regs.a);
        m.step(0x3ffd, 4); // and a
        if (regs.fZ) {
          m.step(0x400b, 10); // jp z,0x400b taken -- empty slot
          label = 0x400b;
          continue;
        }
        m.step(0x4000, 10); // jp z NOT taken

        regs.a = regs.inc8(regs.a);
        m.step(0x4001, 4); // inc a -- Z iff (ix+0x00) was 0xFF
        if (regs.fNZ) {
          m.step(0x4008, 12); // jr nz,0x4008 taken
          label = 0x4008;
          continue;
        }
        m.step(0x4003, 7); // jr nz NOT taken -- (ix+0x00) was 0xFF

        m.push16(0x4006);
        m.step(0x4017, 17); // call 0x4017
        m.call(0x4017);

        m.step(0x400b, 12); // jr 0x400b
        label = 0x400b;
        continue;

      case 0x4008:
        m.push16(0x400b);
        m.step(0x406c, 17); // call 0x406c
        m.call(0x406c);

      case 0x400b:
        regs.de = 0x0010;
        m.step(0x400e, 10); // ld de,0x0010 -- the slot stride
        regs.addIx(regs.de);
        m.step(0x4010, 15); // add ix,de
        regs.iy = (regs.iy + 1) & 0xffff; // 16-bit INC: no flags
        m.step(0x4012, 10); // inc iy
        regs.iy = (regs.iy + 1) & 0xffff;
        m.step(0x4014, 10); // inc iy -- IY strides by 2 against IX's 0x10
        if (regs.djnz() === 0) {
          m.step(0x4016, 8); // djnz NOT taken -- every slot done
          m.ret(10); // ret
          return;
        }
        m.step(0x3ff9, 13); // djnz 0x3ff9 taken
        label = 0x3ff9;
        continue;
    }
  }
}
