// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3dc9  (ROM 0x3dc9-0x3dda) — derives the colour-RAM and video-RAM
 * addresses for the tile whose offset word lives at 0x805a.
 *
 *   3dc9  2a 5a 80     ld   hl,(0x805a)
 *   3dcc  11 00 88     ld   de,0x8800
 *   3dcf  19           add  hl,de
 *   3dd0  22 5e 80     ld   (0x805e),hl
 *   3dd3  11 00 08     ld   de,0x0800
 *   3dd6  19           add  hl,de
 *   3dd7  22 60 80     ld   (0x8060),hl
 *   3dda  c9           ret
 *
 * HL starts as the tile offset word@0x805a. Adding 0x8800 (colour-RAM base)
 * gives the colour-RAM address, stored at 0x805e. A further +0x0800 lands the
 * running HL at offset+0x9000 (video-RAM base), stored at 0x8060. So 0x805e and
 * 0x8060 are the SAME tile's colour and tilemap cells. Both `add hl,de` set
 * H/N/C via addHl, but nothing here (nor the ret) reads them.
 */
export function loc_3dc9(m) {
  const { regs, mem } = m;

  regs.hl = mem.read16(0x805a);
  m.step(0x3dcc, 16); // ld hl,(0x805a) -- tile offset word

  regs.de = 0x8800;
  m.step(0x3dcf, 10); // ld de,0x8800 -- colour-RAM base

  regs.addHl(regs.de); // HL = offset + 0x8800; sets H/N/C (unread here)
  m.step(0x3dd0, 11); // add hl,de

  mem.write16(0x805e, regs.hl);
  m.step(0x3dd3, 16); // ld (0x805e),hl -- colour-RAM address

  regs.de = 0x0800;
  m.step(0x3dd6, 10); // ld de,0x0800 -- bump from colour to video base

  regs.addHl(regs.de); // HL = offset + 0x9000; sets H/N/C (unread here)
  m.step(0x3dd7, 11); // add hl,de

  mem.write16(0x8060, regs.hl);
  m.step(0x3dda, 16); // ld (0x8060),hl -- video-RAM address

  m.ret(); // ret
}
