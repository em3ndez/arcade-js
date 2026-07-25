// SPDX-License-Identifier: GPL-3.0-only

/*
 * A rst 0x18 countdown gate that FALLS THROUGH into the existing loc_0c92
 * (0x0C92) -- so it is a SECOND, GATED entry point into that body. loc_0c91 is
 * the 0x0702 table's index-10 target.
 *
 * rst 0x18 (sub_0018) is the single-level countdown skip: it runs loc_0c92 only
 * when 0x6009 expires, else skips (control returns to loc_0c91's caller's caller
 * and loc_0c92 never runs). Void return on skip -- same convention as loc_084b /
 * handler_0763. sub_0018's `ret z` lands pc at 0x0C92, so loc_0c92 falls through
 * directly (no explicit fall-through step needed).
 */
/**
 * loc_0c91  (ROM 0x0C91) — rst 0x18 gate; second, gated entry into loc_0c92.
 *
 *   0c91  df           rst  0x18        ; skip loc_0c92 unless 0x6009 expires
 *   0c92  ...          (falls through into the existing loc_0c92 body)
 */
export function loc_0c91(m) {
  m.push16(0x0c92); // rst 0x18 pushes its return address = 0x0C92 (the fall-through)
  m.step(0x0018, 11); // rst 0x18
  if (!m.call(0x0018)) return; // counter still ticking -- skipped; loc_0c92 does not run

  return m.call(0x0c92); // pc is already 0x0C92 (sub_0018's ret z); its ret returns for us
}
