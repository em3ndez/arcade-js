// SPDX-License-Identifier: GPL-3.0-only
// loc_ae1c  (ROM 0xae1c-0xae4d) -- builds a checksum-ish nibble into $29/$011f from $60ca/$60da,
// then loads a=0xff and falls through into loc_ae4e (a separate registered routine / jmp leader).
export function loc_ae1c(m) {
  const { regs, mem } = m;
  m.push16(0xae1e); m.step(0xae1f, 6); m.call(0xa8b4);
  regs.sei(); m.step(0xae20, 2);
  regs.a = mem.read8(0x60ca); regs.setNZ(regs.a); m.step(0xae23, 4);
  regs.y = mem.read8(0x60ca); regs.setNZ(regs.y); m.step(0xae26, 4);
  mem.write8(0x29, regs.y); m.step(0xae28, 3);
  regs.a = regs.lsr(regs.a); m.step(0xae29, 2);
  regs.a = regs.lsr(regs.a); m.step(0xae2a, 2);
  regs.a = regs.lsr(regs.a); m.step(0xae2b, 2);
  regs.a = regs.lsr(regs.a); m.step(0xae2c, 2);
  regs.eor(mem.read8(0x29)); m.step(0xae2e, 3);
  mem.write8(0x29, regs.a); m.step(0xae30, 3);
  regs.a = mem.read8(0x60da); regs.setNZ(regs.a); m.step(0xae33, 4);
  regs.y = mem.read8(0x60da); regs.setNZ(regs.y); m.step(0xae36, 4);
  regs.cli(); m.step(0xae37, 2);
  regs.eor(mem.read8(0x29)); m.step(0xae39, 3);
  regs.and(0xf0); m.step(0xae3b, 2);
  regs.eor(mem.read8(0x29)); m.step(0xae3d, 3);
  mem.write8(0x29, regs.a); m.step(0xae3f, 3);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xae40, 2);
  regs.a = regs.asl(regs.a); m.step(0xae41, 2);
  regs.a = regs.asl(regs.a); m.step(0xae42, 2);
  regs.a = regs.asl(regs.a); m.step(0xae43, 2);
  regs.a = regs.asl(regs.a); m.step(0xae44, 2);
  regs.eor(mem.read8(0x29)); m.step(0xae46, 3);
  mem.write8(0x011f, regs.a); m.step(0xae49, 4);
  m.push16(0xae4b); m.step(0xae4c, 6); m.call(0xaf26);
  regs.a = 0xff; regs.setNZ(regs.a); m.step(0xae4e, 2);
  return m.call(0xae4e); // fall through into loc_ae4e (no return pushed; its rts pops our caller's)
}
