// SPDX-License-Identifier: GPL-3.0-only

// loc_1cff  (ROM 0x1CFF-0x1D76) — frog-Y home-row cp-ladder. A = (0x8044) (frog Y) is compared against
// the six home-row band boundaries; each band tails to its row handler 0x1d87/1dd8/1e29/1e7a/1ecb, and
// every gap between bands (and A below 0x15) tails to loc_1d77. A below all bands falls through to loc_1d77.
export function loc_1cff(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8044);
  m.step(0x1d02, 13);
  regs.cp(0x15);
  m.step(0x1d04, 7);
  if (regs.fC) {
    m.step(0x1d77, 10);
    return m.call(0x1d77);
  }
  m.step(0x1d07, 10);
  regs.cp(0x1c);
  m.step(0x1d09, 7);
  if (regs.fZ) {
    m.step(0x1d87, 10);
    return m.call(0x1d87);
  }
  m.step(0x1d0c, 10);
  if (regs.fC) {
    m.step(0x1d87, 10);
    return m.call(0x1d87);
  }
  m.step(0x1d0f, 10);
  regs.cp(0x2e);
  m.step(0x1d11, 7);
  if (regs.fC) {
    m.step(0x1d77, 10);
    return m.call(0x1d77);
  }
  m.step(0x1d14, 10);
  regs.cp(0x35);
  m.step(0x1d16, 7);
  if (regs.fZ) {
    m.step(0x1d77, 10);
    return m.call(0x1d77);
  }
  m.step(0x1d19, 10);
  if (regs.fC) {
    m.step(0x1d77, 10);
    return m.call(0x1d77);
  }
  m.step(0x1d1c, 10);
  regs.cp(0x45);
  m.step(0x1d1e, 7);
  if (regs.fC) {
    m.step(0x1d77, 10);
    return m.call(0x1d77);
  }
  m.step(0x1d21, 10);
  regs.cp(0x4c);
  m.step(0x1d23, 7);
  if (regs.fZ) {
    m.step(0x1dd8, 10);
    return m.call(0x1dd8);
  }
  m.step(0x1d26, 10);
  if (regs.fC) {
    m.step(0x1dd8, 10);
    return m.call(0x1dd8);
  }
  m.step(0x1d29, 10);
  regs.cp(0x5e);
  m.step(0x1d2b, 7);
  if (regs.fC) {
    m.step(0x1d77, 10);
    return m.call(0x1d77);
  }
  m.step(0x1d2e, 10);
  regs.cp(0x65);
  m.step(0x1d30, 7);
  if (regs.fZ) {
    m.step(0x1d77, 10);
    return m.call(0x1d77);
  }
  m.step(0x1d33, 10);
  if (regs.fC) {
    m.step(0x1d77, 10);
    return m.call(0x1d77);
  }
  m.step(0x1d36, 10);
  regs.cp(0x75);
  m.step(0x1d38, 7);
  if (regs.fC) {
    m.step(0x1d77, 10);
    return m.call(0x1d77);
  }
  m.step(0x1d3b, 10);
  regs.cp(0x7c);
  m.step(0x1d3d, 7);
  if (regs.fZ) {
    m.step(0x1e29, 10);
    return m.call(0x1e29);
  }
  m.step(0x1d40, 10);
  if (regs.fC) {
    m.step(0x1e29, 10);
    return m.call(0x1e29);
  }
  m.step(0x1d43, 10);
  regs.cp(0x8e);
  m.step(0x1d45, 7);
  if (regs.fC) {
    m.step(0x1d77, 10);
    return m.call(0x1d77);
  }
  m.step(0x1d48, 10);
  regs.cp(0x95);
  m.step(0x1d4a, 7);
  if (regs.fZ) {
    m.step(0x1d77, 10);
    return m.call(0x1d77);
  }
  m.step(0x1d4d, 10);
  if (regs.fC) {
    m.step(0x1d77, 10);
    return m.call(0x1d77);
  }
  m.step(0x1d50, 10);
  regs.cp(0xa5);
  m.step(0x1d52, 7);
  if (regs.fC) {
    m.step(0x1d77, 10);
    return m.call(0x1d77);
  }
  m.step(0x1d55, 10);
  regs.cp(0xac);
  m.step(0x1d57, 7);
  if (regs.fZ) {
    m.step(0x1e7a, 10);
    return m.call(0x1e7a);
  }
  m.step(0x1d5a, 10);
  if (regs.fC) {
    m.step(0x1e7a, 10);
    return m.call(0x1e7a);
  }
  m.step(0x1d5d, 10);
  regs.cp(0xbe);
  m.step(0x1d5f, 7);
  if (regs.fC) {
    m.step(0x1d77, 10);
    return m.call(0x1d77);
  }
  m.step(0x1d62, 10);
  regs.cp(0xc5);
  m.step(0x1d64, 7);
  if (regs.fZ) {
    m.step(0x1d77, 10);
    return m.call(0x1d77);
  }
  m.step(0x1d67, 10);
  if (regs.fC) {
    m.step(0x1d77, 10);
    return m.call(0x1d77);
  }
  m.step(0x1d6a, 10);
  regs.cp(0xd5);
  m.step(0x1d6c, 7);
  if (regs.fC) {
    m.step(0x1d77, 10);
    return m.call(0x1d77);
  }
  m.step(0x1d6f, 10);
  regs.cp(0xdc);
  m.step(0x1d71, 7);
  if (regs.fZ) {
    m.step(0x1ecb, 10);
    return m.call(0x1ecb);
  }
  m.step(0x1d74, 10);
  if (regs.fC) {
    m.step(0x1ecb, 10);
    return m.call(0x1ecb);
  }
  m.step(0x1d77, 10);
  return m.call(0x1d77); // fall through to loc_1d77
}
