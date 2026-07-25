// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_4673  (ROM 0x4673-0x467a) -- the "+1 point" score entry (The Pit).
 *
 * Queues sound-effect 0x0D (call 0x4c83 loads A=0x0D and vectors the sound
 * trigger), loads the score increment BC=0x0001, then TAIL-JUMPS into the
 * shared BCD score-add + on-screen-digit routine at 0x4689. It is one of three
 * sibling entries that differ only in the sound id and the BC increment:
 *   sub_4673  call 0x4c83 (sfx 0x0D) · BC=0x0001  (+1)
 *   sub_467b  call 0x4c8f (sfx 0x10) · BC=0x0010  (+10, BCD)
 *   sub_4683  call 0x4c8f (sfx 0x10) · BC=0x0020  (+20, BCD)
 * BC is passed to 0x4689 as the amount to add: C into the low score byte
 * (0x8031, DAA) and B (with carry) into the high byte (0x8034, DAA).
 *
 *   4673  cd 83 4c     call 0x4c83
 *   4676  01 01 00     ld   bc,0x0001
 *   4679  18 0e        jr   0x4689
 *
 * Control-flow note: `jr 0x4689` is an UNCONDITIONAL tail-jump into the separate
 * routine sub_4689 -- nothing is pushed for it, so it is modelled
 * `m.step(0x4689,12); return m.call(0x4689)`. sub_4689 runs its own `ret`, which
 * pops OUR caller's return address, so control never comes back here.
 * (Role is best-effort from the code; addresses, cycles and control flow are exact.)
 */
export function sub_4673(m) {
  const { regs } = m;

  // 4673  call 0x4c83 -- queue sound-effect 0x0D (returns to 0x4676)
  m.push16(0x4676); m.step(0x4c83, 17); m.call(0x4c83);
  // 4676  ld bc,0x0001 -- score increment = 1 point
  regs.bc = 0x0001;
  m.step(0x4679, 10);
  // 4679  jr 0x4689 -- tail-jump into the shared scorer (its ret returns to OUR caller)
  m.step(0x4689, 12);
  return m.call(0x4689);
}
