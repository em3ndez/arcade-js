// SPDX-License-Identifier: GPL-3.0-only

// loc_3e9c  (ROM 0x3e9c-0x3f5b) -- object state-6 handler (0x33a7 dispatch, index 6), the in-flight
// mover for a spawned object. Ticks loc_4006, then two modes selected by (ix+0x01) bit0:
//   - waypoint mode (bit0 set, 0x3f1d): follow a script at (ix+0x12:0x13) -- read a dx/dy pair
//     (0xee is an inline "jump back 3" marker), apply it to the 16-bit position, and once the high
//     byte (ix+0x04) reaches 0x1e, land via the 0x3ee1 tail.
//   - free mode (bit0 clear): advance (ix+0x05) by the velocity (ix+0x12), then either home toward a
//     target ((ix+0x08) bit0 set) or drift on a 4-frame cadence, until (ix+0x06)&0x1f hits 0x1a and
//     (ix+0x05) < 0xa0, at which point the 0x3ed3/0x3ee1 tail queues animation 0x40b4 (loc_381e) and
//     flips the object to landing state 2.
export function loc_3e9c(m) {
  const { regs, mem } = m;

  // 0x3ee1 tail: queue the landing animation and re-arm the object, then ret.
  const tail3ee1 = () => {
    regs.de = 0x40b4; m.step(0x3ee4, 10);
    m.push16(0x3ee7); m.step(0x381e, 17); m.call(0x381e);
    mem.write8((regs.ix + 0x11) & 0xffff, 0x0a); m.step(0x3eeb, 19);
    mem.write8((regs.ix + 0x02) & 0xffff, 0x02); m.step(0x3eef, 19);
    mem.write8((regs.ix + 0x00) & 0xffff, 0x00); m.step(0x3ef3, 19);
    mem.write8((regs.ix + 0x01) & 0xffff, 0x01); m.step(0x3ef7, 19);
    m.ret();
  };

  // 0x3ed3 tail: gate on (ix+0x06)&0x1f == 0x1a and (ix+0x05) < 0xa0, else ret; falls into 0x3ee1.
  const tail3ed3 = () => {
    regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x3ed6, 19);
    regs.and(0x1f); m.step(0x3ed8, 7);
    regs.cp(0x1a); m.step(0x3eda, 7);
    if (regs.fC) { m.ret(11); return; }
    m.step(0x3edb, 5);
    regs.a = mem.read8((regs.ix + 0x05) & 0xffff); m.step(0x3ede, 19);
    regs.cp(0xa0); m.step(0x3ee0, 7);
    if (regs.fNC) { m.ret(11); return; }
    m.step(0x3ee1, 5);
    tail3ee1();
  };

  m.push16(0x3e9f); m.step(0x4006, 17); m.call(0x4006);
  regs.bit(0, mem.read8((regs.ix + 0x01) & 0xffff)); m.step(0x3ea3, 20);
  if (regs.fNZ) {
    m.step(0x3f1d, 10); // 3ea3  jp nz,0x3f1d -- waypoint mode
    regs.l = mem.read8((regs.ix + 0x12) & 0xffff); m.step(0x3f20, 19);
    regs.h = mem.read8((regs.ix + 0x13) & 0xffff); m.step(0x3f23, 19);
    regs.a = mem.read8(regs.hl); m.step(0x3f24, 7);
    regs.c = regs.a; m.step(0x3f25, 4);
    regs.cp(0xee); m.step(0x3f27, 7);
    if (regs.fNZ) {
      m.step(0x3f2a, 12);
    } else {
      m.step(0x3f29, 7);
      regs.hl = (regs.hl + 1) & 0xffff; m.step(0x3f2a, 6);
    }
    regs.b = mem.read8(regs.hl); m.step(0x3f2b, 7);
    regs.a = mem.read8((regs.ix + 0x05) & 0xffff); m.step(0x3f2e, 19);
    regs.sub(regs.b); m.step(0x3f2f, 4);
    mem.write8((regs.ix + 0x05) & 0xffff, regs.a); m.step(0x3f32, 19);
    if (regs.fNC) {
      m.step(0x3f37, 12);
    } else {
      m.step(0x3f34, 7);
      regs.decMem8(mem, (regs.ix + 0x06) & 0xffff); m.step(0x3f37, 23);
    }
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x3f38, 6);
    regs.a = mem.read8(regs.hl); m.step(0x3f39, 7);
    regs.add(mem.read8((regs.ix + 0x03) & 0xffff)); m.step(0x3f3c, 19);
    mem.write8((regs.ix + 0x03) & 0xffff, regs.a); m.step(0x3f3f, 19);
    if (regs.fNC) {
      m.step(0x3f44, 12);
    } else {
      m.step(0x3f41, 7);
      regs.incMem8(mem, (regs.ix + 0x04) & 0xffff); m.step(0x3f44, 23);
    }
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x3f45, 6);
    regs.a = regs.c; m.step(0x3f46, 4);
    regs.cp(0xee); m.step(0x3f48, 7);
    if (regs.fNZ) {
      m.step(0x3f4d, 12);
    } else {
      m.step(0x3f4a, 7);
      regs.hl = (regs.hl - 1) & 0xffff; m.step(0x3f4b, 6);
      regs.hl = (regs.hl - 1) & 0xffff; m.step(0x3f4c, 6);
      regs.hl = (regs.hl - 1) & 0xffff; m.step(0x3f4d, 6);
    }
    mem.write8((regs.ix + 0x12) & 0xffff, regs.l); m.step(0x3f50, 19);
    mem.write8((regs.ix + 0x13) & 0xffff, regs.h); m.step(0x3f53, 19);
    regs.a = mem.read8((regs.ix + 0x04) & 0xffff); m.step(0x3f56, 19);
    regs.cp(0x1e); m.step(0x3f58, 7);
    if (regs.fC) { m.ret(11); return; }
    m.step(0x3f59, 5);
    m.step(0x3ee1, 10);
    tail3ee1(); return;
  }
  m.step(0x3ea6, 10); // 3ea3  jp nz (not taken) -- free mode

  regs.l = mem.read8((regs.ix + 0x12) & 0xffff); m.step(0x3ea9, 19);
  regs.h = mem.read8((regs.ix + 0x13) & 0xffff); m.step(0x3eac, 19);
  regs.a = mem.read8((regs.ix + 0x05) & 0xffff); m.step(0x3eaf, 19);
  regs.add(regs.l); m.step(0x3eb0, 4);
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a); m.step(0x3eb3, 19);
  if (regs.fNC) {
    m.step(0x3eb8, 12);
  } else {
    m.step(0x3eb5, 7);
    regs.incMem8(mem, (regs.ix + 0x06) & 0xffff); m.step(0x3eb8, 23);
  }
  regs.bit(0, mem.read8((regs.ix + 0x08) & 0xffff)); m.step(0x3ebc, 20);
  if (regs.fZ) {
    m.step(0x3f01, 12); // 3ebc  jr z,0x3f01 -- drift cadence
    regs.incMem8(mem, (regs.ix + 0x16) & 0xffff); m.step(0x3f04, 23);
    regs.a = mem.read8((regs.ix + 0x16) & 0xffff); m.step(0x3f07, 19);
    regs.and(0x03); m.step(0x3f09, 7);
    if (regs.fZ) { m.ret(11); return; }
    m.step(0x3f0a, 5);
    regs.a = regs.h; m.step(0x3f0b, 4);
    regs.add(0x01); m.step(0x3f0d, 7);
    mem.write8((regs.ix + 0x13) & 0xffff, regs.a); m.step(0x3f10, 19);
    regs.add(mem.read8((regs.ix + 0x03) & 0xffff)); m.step(0x3f13, 19);
    mem.write8((regs.ix + 0x03) & 0xffff, regs.a); m.step(0x3f16, 19);
    if (regs.fNC) {
      m.step(0x3f1b, 12);
    } else {
      m.step(0x3f18, 7);
      regs.incMem8(mem, (regs.ix + 0x04) & 0xffff); m.step(0x3f1b, 23);
    }
    m.step(0x3ed3, 12);
    tail3ed3(); return;
  }
  m.step(0x3ebe, 7); // 3ebc  jr z (not taken) -- homing

  regs.a = regs.h; m.step(0x3ebf, 4);
  regs.sub(0x02); m.step(0x3ec1, 7);
  if (regs.fC) {
    m.step(0x3ef8, 12); // 3ec1  jr c,0x3ef8 -- target reached
    mem.write8((regs.ix + 0x08) & 0xffff, regs.res(0, mem.read8((regs.ix + 0x08) & 0xffff))); m.step(0x3efc, 23);
    regs.xor(regs.a); m.step(0x3efd, 4);
    mem.write8((regs.ix + 0x13) & 0xffff, regs.a); m.step(0x3f00, 19);
    m.ret(); return;
  }
  m.step(0x3ec3, 7);
  regs.h = regs.a; m.step(0x3ec4, 4);
  regs.a = mem.read8((regs.ix + 0x03) & 0xffff); m.step(0x3ec7, 19);
  regs.sub(regs.h); m.step(0x3ec8, 4);
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a); m.step(0x3ecb, 19);
  if (regs.fNC) {
    m.step(0x3ed0, 12);
  } else {
    m.step(0x3ecd, 7);
    regs.decMem8(mem, (regs.ix + 0x04) & 0xffff); m.step(0x3ed0, 23);
  }
  mem.write8((regs.ix + 0x13) & 0xffff, regs.h); m.step(0x3ed3, 19);
  tail3ed3(); return;
}
