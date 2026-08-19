// SPDX-License-Identifier: GPL-3.0-only
//
// loc_7625  (ROM 0x7625-0x7638) -- twin entry to loc_7621: seeds B=0x08, then falls into the
// shared animation-tick walk at 0x7627. loc_7627 ticks B entries of a struct array at IX=0x8ae0
// (stride 0x18) via 0x7638. A tick handler may CALLER-SKIP (pop af; ret) to abort the whole walk
// and unwind to loc_7625's caller; the loop propagates that as an early return.
// Un-annotated instruction addresses = the previous m.step's nextAddr arg.
export function loc_7625(m) {
  const { regs } = m;

  regs.b = 0x08;
  m.step(0x7627, 7); // 7625  ld b,0x08 -- then fall into loc_7627
  return m.call(0x7627);
}

// loc_7627  (ROM 0x7627-0x7638) -- shared body: for B entries at IX (stride DE=0x18), tick each via
// 0x7638 with the loop counter parked in B' across the call (exx guards B and DE). When the tick
// caller-skips, m.call(0x7638) returns false: the stack is already unwound past us, so return with
// no ret of our own.
export function loc_7627(m) {
  const { regs } = m;

  regs.ix = 0x8ae0;
  m.step(0x762b, 14); // 7627  ld ix,0x8ae0
  regs.de = 0x0018;
  m.step(0x762e, 10); // 762b  ld de,0x0018

  for (;;) {
    regs.exx();
    m.step(0x762f, 4); // 762e  exx -- park B (counter) and DE in the alt set
    m.push16(0x7632);
    m.step(0x7638, 17); // 762f  call 0x7638
    if (!m.call(0x7638)) return; // tick caller-skipped -> unwound past us
    regs.exx();
    m.step(0x7633, 4); // 7632  exx -- restore B and DE
    regs.addIx(regs.de);
    m.step(0x7635, 15); // 7633  add ix,de
    regs.djnz();
    if (regs.b) { m.step(0x762e, 13); continue; } // 7635  djnz 0x762e
    m.step(0x7637, 8);
    break;
  }
  m.ret(); // 7637  ret
}
