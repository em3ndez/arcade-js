// SPDX-License-Identifier: GPL-3.0-only
// loc_b967  (ROM 0xb967-0xb97b) -- if $0415==0 load A/X from $ce87/$ce86 else from $ce6f/$ce6e
// (clv/bvc is the unconditional skip past the else arm), then rts.
export function loc_b967(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0415); regs.setNZ(regs.a); m.step(0xb96a, 4);
  // b96a beq 0xb975
  if (regs.fZ) {
    m.step(0xb975, 3);
    regs.a = mem.read8(0xce87); regs.setNZ(regs.a); m.step(0xb978, 4);
    regs.x = mem.read8(0xce86); regs.setNZ(regs.x); m.step(0xb97b, 4);
  } else {
    m.step(0xb96c, 2);
    regs.a = mem.read8(0xce6f); regs.setNZ(regs.a); m.step(0xb96f, 4);
    regs.x = mem.read8(0xce6e); regs.setNZ(regs.x); m.step(0xb972, 4);
    regs.clv(); m.step(0xb973, 2);
    m.step(0xb97b, 3);
  }
  return m.ret(6);
}
