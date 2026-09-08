// SPDX-License-Identifier: GPL-3.0-only
// loc_385c (ROM 0x385c-0x3871) -- normalizes a character code (bit-5 fold, 0x2A wrap) around a saved-flags JSR.
export function loc_385c(m) {
  const { regs, mem } = m;
  let label = 0x385c;
  for (;;) {
    switch (label) {
      case 0x385c: {
        if (regs.fNC) { // 385c bcc $3862
          m.step(0x3862, 3); label = 0x3862; continue;
        }
        m.step(0x385e, 2);
        regs.and(0x0f); m.step(0x3860, 2); // 385e and #$0f
        if (regs.fZ) { // 3860 beq $3865
          m.step(0x3865, 3); label = 0x3865; continue;
        }
        m.step(0x3862, 2);
        label = 0x3862; continue;
      }
      case 0x3862: {
        regs.clc(); m.step(0x3863, 2); // 3862 clc
        regs.ora(0x20); m.step(0x3865, 2); // 3863 ora #$20
        label = 0x3865; continue;
      }
      case 0x3865: {
        m.push8(regs.p); m.step(0x3866, 3); // 3865 php
        regs.cmp(0x2a); m.step(0x3868, 2); // 3866 cmp #$2a
        if (regs.fNC) { // 3868 bcc $386c
          m.step(0x386c, 3); label = 0x386c; continue;
        }
        m.step(0x386a, 2);
        regs.sbc(0x29); m.step(0x386c, 2); // 386a sbc #$29
        label = 0x386c; continue;
      }
      case 0x386c: {
        m.step(0x386f, 6); m.call(0x3836); // 386c jsr $3836
        regs.p = m.pull8(); m.step(0x3870, 4); // 386f plp
        return m.ret(6); // 3870 rts
      }
    }
  }
}
