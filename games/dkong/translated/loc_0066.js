// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/dkong/io.js";
import { loc_0087 } from "./loc_0087.js";
import { loc_00b5 } from "./loc_00b5.js";

/**
 * loc_0066  (ROM 0x0066–0x00DF) — vblank NMI.
 *
 *   0066  f5           push af
 *   0067  c5           push bc
 *   0068  d5           push de
 *   0069  e5           push hl
 *   006a  dd e5        push ix
 *   006c  fd e5        push iy
 *   006e  af           xor  a
 *   006f  32 84 7d     ld   (0x7d84),a
 *   0072  3a 00 7d     ld   a,(0x7d00)
 *   0075  e6 01        and  0x01
 *   0077  c2 00 40     jp   nz,0x4000
 *   007a  21 38 01     ld   hl,0x0138
 *   007d  cd 41 01     call 0x0141
 *   0080  3a 07 60     ld   a,(0x6007)
 *   0083  a7           and  a
 *   0084  c2 b5 00     jp   nz,0x00b5
 *   0087  3a 26 60     ld   a,(0x6026)
 *   008a  a7           and  a
 *   008b  c2 98 00     jp   nz,0x0098
 *   008e  3a 0e 60     ld   a,(0x600e)
 *   0091  a7           and  a
 *   0092  3a 80 7c     ld   a,(0x7c80)
 *   0095  c2 9b 00     jp   nz,0x009b
 *   0098  3a 00 7c     ld   a,(0x7c00)       ; loc_0098
 *   009b  47           ld   b,a              ; loc_009b
 *   009c  e6 0f        and  0x0f
 *   009e  4f           ld   c,a
 *   009f  3a 11 60     ld   a,(0x6011)
 *   00a2  2f           cpl
 *   00a3  a0           and  b
 *   00a4  e6 10        and  0x10
 *   00a6  17           rla
 *   00a7  17           rla
 *   00a8  17           rla
 *   00a9  b1           or   c
 *   00aa  60           ld   h,b
 *   00ab  6f           ld   l,a
 *   00ac  22 10 60     ld   (0x6010),hl
 *   00af  78           ld   a,b
 *   00b0  cb 77        bit  6,a
 *   00b2  c2 00 00     jp   nz,0x0000
 *   00b5  21 1a 60     ld   hl,0x601a        ; loc_00b5
 *   00b8  35           dec  (hl)
 *   00b9  cd 57 00     call 0x0057
 *   00bc  cd 7b 01     call 0x017b
 *   00bf  cd e0 00     call 0x00e0
 *   00c2  21 d2 00     ld   hl,0x00d2
 *   00c5  e5           push hl
 *   00c6  3a 05 60     ld   a,(0x6005)
 *   00c9  ef           rst  0x28
 *   00ca  <4-entry jump table: 0x01c3 0x073c 0x08b2 0x06fe>
 *   00d2  fd e1        pop  iy               ; loc_00d2
 *   00d4  dd e1        pop  ix
 *   00d6  e1           pop  hl
 *   00d7  d1           pop  de
 *   00d8  c1           pop  bc
 *   00d9  3e 01        ld   a,0x01
 *   00db  32 84 7d     ld   (0x7d84),a
 *   00de  f1           pop  af
 *   00df  c9           ret
 *
 * Structure: acknowledge (clear the NMI mask), read inputs, blit sprites via
 * DMA, debounce/latch the controls into 0x6010/0x6011, decrement the frame
 * counter at 0x601A -- which is what releases the main loop's spin -- then
 * dispatch on game state 0x6005 through the 4-entry table at 0x00CA, and
 * restore.
 *
 * NOTE the counter at 0x601A is DECREMENTED here. The main loop increments a
 * DIFFERENT address (0x6019) and only compares 0x601A against its saved copy
 * at 0x6383, so the direction never mattered to the loop -- but getting it
 * backwards would corrupt every timer keyed off it.
 *
 * `ret` and not `retn`: DK gates interrupts with the 0x7D84 mask rather than
 * IFF, so the epilogue re-enables by writing the mask at 0x00DB. Note it
 * re-enables BEFORE `pop af`, so a pending NMI could in principle land
 * between the two.
 */
export function loc_0066(m) {
  const { regs, mem } = m;

  m.push16(regs.af);
  m.tick(11);
  m.push16(regs.bc);
  m.tick(11);
  m.push16(regs.de);
  m.tick(11);
  m.push16(regs.hl);
  m.tick(11);
  m.push16(regs.ix);
  m.tick(15);
  m.push16(regs.iy);
  m.tick(15);

  // Acknowledge: clearing the mask is the ack, and it also means a second
  // vblank cannot re-enter this handler until the epilogue re-enables it.
  regs.xor(regs.a);
  m.tick(4);
  mem.write8(0x7d84, regs.a, 10);
  m.tick(13);

  // Reading IN2 KICKS THE WATCHDOG -- the read is the kick.
  regs.a = mem.read8(0x7d00);
  m.tick(13);
  regs.and(0x01);
  m.tick(7);
  if (regs.fNZ) {
    m.tick(10);
    // SERVICE is out-of-policy input. 0x4000 is a diagnostic ROM base dkong
    // does not ship; MAME reads that region as 0x00 (a NOP slide), though our
    // AddressSpace throws there rather than modelling it. Throw rather than
    // model it -- this converts an unknown into a coverage assertion, and a
    // tape that reaches here is itself the bug.
    throw new NotImplemented(
      "SERVICE switch held: jp 0x4000 at ROM 0x0077 -- out-of-policy input, " +
        "no diagnostic ROM exists on this romset",
    );
  }
  m.tick(10);

  // Sprite DMA blit: HL points at the 9-byte i8257 setup block at 0x0138-0x0140.
  regs.hl = 0x0138;
  m.tick(10);
  m.push16(0x0080);
  m.tick(17);
  m.call(0x0141);

  regs.a = mem.read8(0x6007);
  m.tick(13);
  regs.and(regs.a);
  m.tick(4);
  if (regs.fNZ) {
    m.tick(10); // jp nz,0x00b5 -- skip input handling entirely
    return loc_00b5(m);
  }
  m.tick(10);

  loc_0087(m);
  return loc_00b5(m);
}
