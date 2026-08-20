// SPDX-License-Identifier: GPL-3.0-only

// loc_1b43  (ROM 0x1b43-0x1b7f) -- a 0x15a8-dispatch state handler. Runs 0x02c9 (bails via
// `ret nz` if it reported not-done), re-seats the scroll pointer (0x02e3), runs 0x075d
// (BC=0x0819), enqueues two display commands (rst 0x38: DE=0x0600 then E=0x02), runs 0x7960,
// sets (0x880a)=0x0c and clears (0x8808). Then it folds a 34-byte checksum over 0x5593
// (each byte: & 0x37, rrca, adc a,c) into C; if the result != 0x7c it bumps (0x881e). Finally
// it seeds DE=0x1ff2 / HL=0x89f0 and FALLS THROUGH into loc_1b80 (the +8 copy loop) -- frame
// reuse, so loc_1b80's ret returns to loc_1b43's caller. rst 0x38 = loc_0038 display enqueue.
export function loc_1b43(m) {
  const { regs, mem } = m;

  m.push16(0x1b46);
  m.step(0x02c9, 17);              // 1b43  call 0x02c9 (pattern A -> 0x1b46)
  m.call(0x02c9);
  if (regs.fNZ) { m.ret(11); return; } // 1b46  ret nz -- 0x02c9 not done
  m.step(0x1b47, 5);              // ret nz not taken

  m.push16(0x1b4a);
  m.step(0x02e3, 17);             // 1b47  call 0x02e3 (pattern A -> 0x1b4a)
  m.call(0x02e3);
  regs.bc = 0x0819;               m.step(0x1b4d, 10);
  m.push16(0x1b50);
  m.step(0x075d, 17);             // 1b4d  call 0x075d (pattern A -> 0x1b50)
  m.call(0x075d);
  regs.de = 0x0600;               m.step(0x1b53, 10);
  m.push16(0x1b54);
  m.step(0x0038, 11);             // 1b53  rst 0x38 (loc_0038 display enqueue, DE)
  m.call(0x0038);
  regs.e = 0x02;                  m.step(0x1b56, 7);
  m.push16(0x1b57);
  m.step(0x0038, 11);             // 1b56  rst 0x38 (loc_0038 display enqueue, DE)
  m.call(0x0038);
  m.push16(0x1b5a);
  m.step(0x7960, 17);             // 1b57  call 0x7960 (pattern A -> 0x1b5a)
  m.call(0x7960);
  regs.a = 0x0c;                  m.step(0x1b5c, 7);
  mem.write8(0x880a, regs.a);     m.step(0x1b5f, 13);
  regs.xor(regs.a);               m.step(0x1b60, 4);
  mem.write8(0x8808, regs.a);     m.step(0x1b63, 13);
  regs.de = 0x5593;               m.step(0x1b66, 10);
  regs.bc = 0x2200;               m.step(0x1b69, 10); // B=0x22 bytes, C=0 accumulator

  for (;;) { // loc_1b69: fold the next source byte into the C accumulator
    regs.a = mem.read8(regs.de);      m.step(0x1b6a, 7);
    regs.and(0x37);                   m.step(0x1b6c, 7);
    regs.rrca();                      m.step(0x1b6d, 4);
    regs.adc(regs.c);                 m.step(0x1b6e, 4);
    regs.c = regs.a;                  m.step(0x1b6f, 4);
    regs.de = (regs.de + 1) & 0xffff; m.step(0x1b70, 6);
    if (regs.djnz()) { m.step(0x1b69, 13); } else { m.step(0x1b72, 8); break; }
  }

  regs.cp(0x7c);                  m.step(0x1b74, 7);
  if (regs.fZ) {
    m.step(0x1b7a, 12);           // 1b74  jr z,0x1b7a taken -- checksum matches, skip the bump
  } else {
    m.step(0x1b76, 7);            // jr z not taken
    regs.hl = 0x881e;             m.step(0x1b79, 10);
    regs.incMem8(mem, regs.hl);   m.step(0x1b7a, 11); // inc (0x881e)
  }

  regs.de = 0x1ff2;               m.step(0x1b7d, 10);
  regs.hl = 0x89f0;               m.step(0x1b80, 10);
  return m.call(0x1b80);          // fall through into loc_1b80 (frame reuse, no push16)
}
