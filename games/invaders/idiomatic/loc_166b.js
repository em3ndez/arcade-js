// SPDX-License-Identifier: GPL-3.0-only

// Set carry ("found") and return true -- the scan's success sentinel; its carry live-out is read via rnc.
// Tiny -- an inline candidate the scan folds directly.
export function loc_166b(m) {
  return (m.regs.fC = true);
}
