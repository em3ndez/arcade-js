// SPDX-License-Identifier: GPL-3.0-only
// loc_9c0c (ROM 0x9c0c-0x9c20) -- demo-state leaf: decrements slot x's timer $0298,x. If still nonzero,
// tail-jumps into sibling loc_9c17 (table-driven $010b reload). If it hit zero, bumps counter $010b and
// falls to the shared rts at $9c20 (clv;bvc is an unconditional join onto loc_9c17's terminating rts).
export function loc_9c0c(m) {
  const { regs, mem } = m;
  { const b = 0x0298, e = (b + regs.x) & 0xffff; mem.write8(e, regs.dec8(mem.read8(e))); m.step(0x9c0f, 7); } // dec $0298,x (abs,x rmw, fixed 7)
  if (regs.fNZ) {
    m.step(0x9c17, 3); return m.call(0x9c17); // bne $9c17 taken -> delegate to exported loc_9c17
  }
  m.step(0x9c11, 2); // bne not taken
  { const e = 0x010b; mem.write8(e, regs.inc8(mem.read8(e))); m.step(0x9c14, 6); } // inc $010b
  regs.clv(); m.step(0x9c15, 2);        // clv
  m.step(0x9c20, 3);                     // bvc $9c20 (unconditional join) -> shared rts
  return m.ret(6); // rts at $9c20
}
