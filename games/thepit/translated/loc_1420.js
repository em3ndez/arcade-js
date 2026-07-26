// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1420  (ROM 0x1420-0x1433) — shared dispatcher tail, entered from loc_13de
 * both via the `jr z` at 0x1410 and via the fall-through past 0x141d. It first
 * defers the whole frame if the 0x80a2 lock byte is set (tail-jump to 0x1b5b),
 * then SELECTS one of two candidate bytes into A and hands it to loc_1434:
 *   A = (0x8001 >= 3) ? mem[0x801b] : mem[0x8018]
 * The `ld a,(0x801b)` is issued BEFORE the branch on purpose — in the "no-carry"
 * (>= 3) case A already holds 0x801b when the jr is taken; only the carry case
 * overwrites it with 0x8018. `cp 0x03` sets the carry the jr reads, and the
 * intervening `ld a,(0x801b)` does not disturb it (ld a,(nn) touches no flags).
 * The block ends by falling through into loc_1434 (its own routine) — modelled
 * as a tail-jump: `return m.call(0x1434)`, whose ret returns to OUR caller, so
 * there is no trailing m.ret. Likewise the `jp nz,0x1b5b` is a tail-jump.
 *
 *   1420  3a a2 80     ld   a,(0x80a2)
 *   1423  a7           and  a
 *   1424  c2 5b 1b     jp   nz,0x1b5b
 *   1427  3a 01 80     ld   a,(0x8001)
 *   142a  fe 03        cp   0x03
 *   142c  3a 1b 80     ld   a,(0x801b)
 *   142f  30 03        jr   nc,0x1434
 *   1431  3a 18 80     ld   a,(0x8018)
 *                      (fall through into loc_1434)
 */
export function loc_1420(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x80a2);
  m.step(0x1423, 13); // ld a,(0x80a2)
  regs.and(regs.a);
  m.step(0x1424, 4); // and a -- test the 0x80a2 lock byte
  if (regs.fNZ) {
    m.step(0x1b5b, 10); // jp nz taken -- locked this frame, defer
    return m.call(0x1b5b);
  }
  m.step(0x1427, 10); // jp nz not taken

  regs.a = mem.read8(0x8001);
  m.step(0x142a, 13); // ld a,(0x8001)
  regs.cp(0x03);
  m.step(0x142c, 7); // cp 0x03 -- carry set iff 0x8001 < 3
  regs.a = mem.read8(0x801b);
  m.step(0x142f, 13); // ld a,(0x801b) -- pre-loaded; does NOT disturb the cp carry
  if (regs.fNC) {
    m.step(0x1434, 12); // jr nc taken -- 0x8001 >= 3, A = mem[0x801b]
    return m.call(0x1434);
  }
  m.step(0x1431, 7); // jr nc not taken

  regs.a = mem.read8(0x8018);
  m.step(0x1434, 13); // ld a,(0x8018) -- 0x8001 < 3, A = mem[0x8018]
  return m.call(0x1434); // fall-through tail-jump into loc_1434; PC already at 0x1434
}
