// SPDX-License-Identifier: GPL-3.0-only
// §4 idiomatic override table for Tempest. resolveAllIdiomatic() (machine.js) walks this map and swaps each
// listed idiomatic module in for its translated (frozen-oracle) routine at the given ROM address. Empty at
// the start of §4; grows leaves-first, batch by batch, until every reachable routine is served idiomatic and
// the translated layer is fully replaced (runbook §4). Shape: { <addr>: { name, entry?, irq? } } where
// module = ./idiomatic/<name>.js and export = entry ?? name.
export const ROUTINES = {};
