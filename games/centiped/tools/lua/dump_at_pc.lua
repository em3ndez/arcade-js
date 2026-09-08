-- SPDX-License-Identifier: GPL-3.0-only
-- Centipede (Atari, MOS 6502) PC-EXACT state capture: a state that exists only PARTWAY through a frame is
-- invisible to frame-boundary sampling, and some of them matter. `space:install_read_tap` works WITHOUT
-- -debug and fires when the byte is READ; tap ONE address and gate on the 6502 CURPC (a tap also sees DATA
-- reads, and boot reads ROM/RAM bytes before most routines run). Same 2048-byte format as dump_state.lua.
-- META carries the register file AT THE TAP; a ONE-SHOT snapshot, no pair. Env: PC_TARGET (default 0x3B04
-- = the rev3 (centiped3) reset entry; the 6502 reset vector 0x3FFC/D points here, NOT to the 0x2000 ROM
-- base, which holds only a JMP ($3B04) that is never itself an executed PC. The rev4 parent 'centiped'
-- resets to 0x3B4B instead -- this port targets rev3), STATE_OUT, PC_META, CONFIG_OUT.

local cpu = manager.machine.devices[":maincpu"]
local sp = cpu.spaces["program"]
local target = tonumber(os.getenv("PC_TARGET") or "0x3B04")

-- Machine CONFIGURATION on EVERY capture path (see dump_state.lua for the 6502 layout: control byte at the
-- 0x2000 ROM base, two dip ports 0x0800/0x0801). All sampled AT SCRIPT LOAD -- the reset state, NOT the
-- tapped-PC regs.
local cfgf = io.open(os.getenv("CONFIG_OUT") or "config.txt", "w")
if cfgf then
  cfgf:setvbuf("no")
  cfgf:write(string.format(
    "control_rom2000=0x%02X\ndsw1=0x%02X\ndsw2=0x%02X\nreset_vector=0x%04X\n",
    sp:read_u8(0x2000), sp:read_u8(0x0800), sp:read_u8(0x0801),
    sp:read_u8(0x3FFC) + sp:read_u8(0x3FFD) * 256))
  for _, rn in ipairs({ "PC", "A", "X", "Y", "P", "SP" }) do
    local ok, v = pcall(function() return cpu.state[rn].value end)
    if ok and v ~= nil then cfgf:write(string.format("reg_%s=0x%04X\n", rn, v)) end
  end
  cfgf:close()
end

local out = assert(io.open(os.getenv("STATE_OUT") or "state_at_pc.bin", "wb"))
out:setvbuf("no")
local meta = io.open(os.getenv("PC_META") or "state_at_pc.txt", "w")
if meta then meta:setvbuf("no") end

-- Mirrors hardware.json "stateRegions" AND boards/centiped/memory.js dumpState() order.
local REGIONS = {
  { 0x0000, 0x03FF, "ram" },
  { 0x0400, 0x07BF, "vram" },
  { 0x07C0, 0x07FF, "spriteram" }
}

_G.__pc_done = false
_G.__pc_tap = sp:install_read_tap(target, target, "pc_exact", function(offset, data, mask)
  -- CURPC IS LOAD-BEARING: boot reads bytes, so for many addresses the FIRST tap hit is a data read whose
  -- state would be captured instead of the routine's opcode fetch.
  if cpu.state["CURPC"].value ~= target then return data end
  -- First opcode fetch only; an entry reached every frame would emit thousands.
  if _G.__pc_done then return data end
  _G.__pc_done = true

  local parts = {}
  for _, r in ipairs(REGIONS) do
    for a = r[1], r[2] do
      parts[#parts + 1] = string.char(sp:read_u8(a))
    end
  end
  out:write(table.concat(parts))

  if meta then
    local secs = manager.machine.time:as_double()
    meta:write(string.format(
      "pc=0x%04X\nopcode_byte=0x%02X\nseconds=%.9f\ncycles=%.0f\n",
      target, data, secs, secs * 1512000))
    -- Registers AS OF THIS FETCH, read inside the tap -- the config.txt copy is only the reset state.
    for _, rn in ipairs({ "PC", "A", "X", "Y", "P", "SP" }) do
      local ok, v = pcall(function() return cpu.state[rn].value end)
      if ok and v ~= nil then meta:write(string.format("reg_%s=0x%04X\n", rn, v)) end
    end
  end
  return data
end)
