// SPDX-License-Identifier: GPL-3.0-only

// loc_3d18  (ROM 0x3d18-0x3d5b) -- object state-2 handler (0x33a7 dispatch, index 2).
// Chooses a frame-timer value and animation for the object from the difficulty byte (0x8d45), the
// child index (ix+0x17)/(ix+0x12) and the direction bit (ix+0x07) bit1: when active it queues a
// display command (rst 0x38, D=0x03) and looks up an animation word from table 0x3dd3 (loc_0c45),
// installs it (loc_381e), then advances the state (inc (ix+0x02)) and FALLS THROUGH into the state-3
// handler loc_3d5c. The b=0x20/0x38 written to (ix+0x11) is the reseeded frame timer.
export function loc_3d18(m) {
  const { regs, mem } = m;

  regs.b = 0x20; m.step(0x3d1a, 7);
  regs.c = mem.read8((regs.ix + 0x17) & 0xffff); m.step(0x3d1d, 19);
  regs.a = mem.read8(0x8d45); m.step(0x3d20, 13);
  regs.and(regs.a); m.step(0x3d21, 4);
  if (regs.fZ) {
    m.step(0x3d3b, 12);
  } else {
    m.step(0x3d23, 7);
    regs.c = mem.read8((regs.ix + 0x12) & 0xffff); m.step(0x3d26, 19);
    regs.c = regs.inc8(regs.c); m.step(0x3d27, 4);
    if (regs.fZ) {
      m.step(0x3d3b, 12);
    } else {
      m.step(0x3d29, 7);
      regs.cp(0x04); m.step(0x3d2b, 7);
      if (regs.fC) {
        m.step(0x3d2f, 12);
      } else {
        m.step(0x3d2d, 7);
        regs.a = 0x03; m.step(0x3d2f, 7); // 3d2d  ld a,0x03 -- clamp
      }
      regs.b = regs.a; m.step(0x3d30, 4);
      regs.add(0x06); m.step(0x3d32, 7);
      regs.c = regs.a; m.step(0x3d33, 4);
      regs.de = 0x030f; m.step(0x3d36, 10);
      regs.add(regs.e); m.step(0x3d37, 4);
      regs.e = regs.a; m.step(0x3d38, 4);
      m.push16(0x3d39); m.step(0x0038, 11); m.call(0x0038); // 3d38  rst 0x38 -- enqueue DE
      regs.b = 0x38; m.step(0x3d3b, 7);
    }
  }

  mem.write8((regs.ix + 0x11) & 0xffff, regs.b); m.step(0x3d3e, 19);
  regs.a = regs.c; m.step(0x3d3f, 4);
  regs.bit(1, mem.read8((regs.ix + 0x07) & 0xffff)); m.step(0x3d43, 20);
  if (regs.fZ) {
    m.step(0x3d50, 12);
  } else {
    m.step(0x3d45, 7);
    regs.c = regs.inc8(regs.c); m.step(0x3d46, 4);
    regs.a = mem.read8(0x8d45); m.step(0x3d49, 13);
    regs.and(regs.a); m.step(0x3d4a, 4);
    regs.a = regs.c; m.step(0x3d4b, 4);
    if (regs.fZ) {
      m.step(0x3d50, 12);
    } else {
      m.step(0x3d4d, 7);
      regs.a = 0x03; m.step(0x3d4f, 7);
      regs.add(regs.c); m.step(0x3d50, 4);
    }
  }

  regs.hl = 0x3dd3; m.step(0x3d53, 10);
  m.push16(0x3d56); m.step(0x0c45, 17); m.call(0x0c45);
  m.push16(0x3d59); m.step(0x381e, 17); m.call(0x381e);
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x3d5c, 23);
  return m.call(0x3d5c);
}
