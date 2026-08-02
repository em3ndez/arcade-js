// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_25f2  (ROM 0x25F2–0x25F4) — ROM head 0x25F2-0x25F4 (rst 0x30 gate-head; sibling of sub_2207).
 *
 *   25f2  3e 02        ld   a,0x02
 *   25f4  f7           rst  0x30        ; SKIPS on coin_start -> return to caller
 *
 * Reached via `call 0x25F2` @0x199A (197a cascade). Same gate mechanism as sub_2207;
 * differs only in the body it gates (0x25F5: call 0x2602 / 0x262f / 0x2679 sub-cascade),
 * which is a non-executing frontier.
 */
export function loc_25f2(m) {
  const { regs } = m;
  regs.a = 0x02;
  m.step(0x25f4, 7); // ld a,0x02
  m.push16(0x25f5); // rst 0x30 pushes the body address
  m.step(0x0030, 11); // rst 0x30
  if (!m.call(0x0030)) return; // gate SKIPPED (coin_start) -> returned to caller
  return sub_25f2_body(m); // 0x25F5: the object sub-cascade (now translated)
}

/**
 * sub_25f2_body  (ROM 0x25F5–0x2601) — loc_25f2's object update: call 2602/262f/2679/2ad3 in sequence.
 */
export function sub_25f2_body(m) {
  m.push16(0x25f8); m.step(0x2602, 17); m.call(0x2602); // call 0x2602
  m.push16(0x25fb); m.step(0x262f, 17); m.call(0x262f); // call 0x262f
  m.push16(0x25fe); m.step(0x2679, 17); m.call(0x2679); // call 0x2679
  m.push16(0x2601); m.step(0x2ad3, 17); m.call(0x2ad3); // call 0x2ad3
  m.ret(10); // 0x2601
}
