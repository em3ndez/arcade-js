// SPDX-License-Identifier: GPL-3.0-only
// loc_9246  (ROM 0x9246-0x926e) -- zeros $0243..$0282 (x=0x3f..0); then for x=[$03ab]-1..0 packs a
// (x<<4 | nibble of [$60ca]) tag into $0203,x and writes $0243,x = tag, or 0x0f when the tag is zero, rts.
export function loc_9246(m) {
  const { regs, mem } = m;
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x9248, 2);
  regs.x = 0x3f; regs.setNZ(regs.x); m.step(0x924a, 2);
  while (true) {
    mem.write8((0x0243 + regs.x) & 0xffff, regs.a); m.step(0x924d, 5);
    regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0x924e, 2);
    if (regs.fN) { m.step(0x9250, 2); break; }
    m.step(0x924a, 3);
  }
  regs.x = mem.read8(0x03ab); regs.setNZ(regs.x); m.step(0x9253, 4);
  regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0x9254, 2);
  while (true) {
    regs.a = mem.read8(0x60ca); regs.setNZ(regs.a); m.step(0x9257, 4);
    regs.and(0x0f); m.step(0x9259, 2);
    mem.write8((0x0203 + regs.x) & 0xffff, regs.a); m.step(0x925c, 5);
    regs.a = regs.x; regs.setNZ(regs.a); m.step(0x925d, 2);
    regs.a = regs.asl(regs.a); m.step(0x925e, 2);
    regs.a = regs.asl(regs.a); m.step(0x925f, 2);
    regs.a = regs.asl(regs.a); m.step(0x9260, 2);
    regs.a = regs.asl(regs.a); m.step(0x9261, 2);
    regs.ora(mem.read8((0x0203 + regs.x) & 0xffff)); m.step(0x9264, 4);
    if (regs.fNZ) {
      m.step(0x9268, 3);
    } else {
      m.step(0x9266, 2);
      regs.a = 0x0f; regs.setNZ(regs.a); m.step(0x9268, 2);
    }
    mem.write8((0x0243 + regs.x) & 0xffff, regs.a); m.step(0x926b, 5);
    regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0x926c, 2);
    if (regs.fN) { m.step(0x926e, 2); break; }
    m.step(0x9254, 3);
  }
  return m.ret(6);
}
