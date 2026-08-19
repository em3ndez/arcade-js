// SPDX-License-Identifier: GPL-3.0-only

const DISPATCH_TABLE_6F3E = "0x6f3e (record state>=0x0b, selector (ix+2)-0x0b): 0..1 = 3e69 3e9c";

// loc_6f2d  (ROM 0x6f2d-0x6f3d) -- per-record state handler for the 0x8ae0 table. State (ix+2)==2
// tail-jumps to 0x3536; states < 0x0b run the generic mover 0x4006 and return; states >= 0x0b
// rst 0x28 tail-dispatch through the 2-word table at 0x6f3e indexed by (ix+2)-0x0b.
export function loc_6f2d(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x02) & 0xffff);
  m.step(0x6f30, 19); // 6f2d  ld a,(ix+0x02)
  regs.cp(0x02);
  m.step(0x6f32, 7); // 6f30  cp 0x02
  if (regs.fZ) {
    m.step(0x3536, 10); // 6f32  jp z,0x3536
    return m.call(0x3536);
  }
  m.step(0x6f35, 10);
  regs.sub(0x0b);
  m.step(0x6f37, 7); // 6f35  sub 0x0b
  if (regs.fNC) {
    m.step(0x6f3d, 12); // 6f37  jr nc,0x6f3d -- state >= 0x0b
  } else {
    m.step(0x6f39, 7);
    m.push16(0x6f3c);
    m.step(0x4006, 17); // 6f39  call 0x4006
    m.call(0x4006);
    m.ret(); // 6f3c  ret
    return;
  }
  m.push16(0x6f3e);
  m.step(0x0028, 11); // 6f3d  rst 0x28 -- pushes inline table base 0x6f3e
  return m.call(0x0028, DISPATCH_TABLE_6F3E);
}
