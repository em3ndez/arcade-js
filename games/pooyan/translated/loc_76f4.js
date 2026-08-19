// SPDX-License-Identifier: GPL-3.0-only

// loc_76f4  (ROM 0x76f4-0x7706) -- iterate loc_7707 over 6 object records, IX = 0x8ba0 + n*0x18.
// The loop counter B and stride DE are parked in the alternate register set (`exx`) across the call
// so loc_7707 (and its rst-0x28 handlers) may freely use BC/DE/HL; IX is unaffected by exx and
// carries the per-record pointer.
export function loc_76f4(m) {
  const { regs } = m;

  regs.ix = 0x8ba0;
  m.step(0x76f8, 14); // 76f4  ld ix,0x8ba0
  regs.de = 0x0018;
  m.step(0x76fb, 10); // 76f8  ld de,0x0018 -- record stride
  regs.b = 0x06;
  m.step(0x76fd, 7); // 76fb  ld b,0x06 -- 6 records

  for (;;) {
    regs.exx();
    m.step(0x76fe, 4); // 76fd  exx -- park counter/stride
    m.push16(0x7701);
    m.step(0x7707, 17); // 76fe  call 0x7707
    m.call(0x7707);
    regs.exx();
    m.step(0x7702, 4); // 7701  exx -- restore counter/stride
    regs.addIx(regs.de);
    m.step(0x7704, 15); // 7702  add ix,de -- next record
    if (regs.djnz() !== 0) { m.step(0x76fd, 13); continue; } // 7704  djnz 0x76fd
    m.step(0x7706, 8);
    break;
  }

  m.ret(); // 7706  ret
}
