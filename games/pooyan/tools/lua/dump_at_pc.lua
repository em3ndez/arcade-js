-- SPDX-License-Identifier: GPL-3.0-only
-- Pooyan PC-EXACT state capture: a state that exists only PARTWAY through a frame is invisible
-- to frame-boundary sampling, and some of them matter. `space:install_read_tap` works WITHOUT
-- -debug and fires when the byte is READ; tap ONE address and gate on CURPC (a tap also sees DATA
-- reads, and the boot self-check reads bytes long before most routines run). Same 4608-byte format
-- as dump_state.lua. META carries the register file AT THE TAP; a ONE-SHOT snapshot, no pair.
-- Env: PC_TARGET (default 0x0000, reset entry), STATE_OUT, PC_META, CONFIG_OUT.

local cpu = manager.machine.devices[":maincpu"]
local sp = cpu.spaces["program"]
local target = tonumber(os.getenv("PC_TARGET") or "0x0000")

-- Machine CONFIGURATION on EVERY capture path: dsw0=DSW0@0xA0E0, dsw1=DSW1@0xA000, ROM[0] proving
-- the image loaded. All sampled AT SCRIPT LOAD: dips as MAME resolved them, reg_* as the Z80 RESET
-- state -- NOT the tapped-PC regs.
local cfgf = io.open(os.getenv("CONFIG_OUT") or "config.txt", "w")
if cfgf then
  cfgf:setvbuf("no")
  cfgf:write(string.format("dsw0=0x%02X\ndsw1=0x%02X\ncontrol_rom0000=0x%02X\n",
    sp:read_u8(0xA0E0), sp:read_u8(0xA000), sp:read_u8(0x0000)))
  for _, rn in ipairs({"AF","BC","DE","HL","IX","IY","SP"}) do
    local ok, v = pcall(function() return cpu.state[rn].value end)
    if ok and v ~= nil then cfgf:write(string.format("reg_%s=0x%04X\n", rn, v)) end
  end
  cfgf:close()
end

local out = assert(io.open(os.getenv("STATE_OUT") or "state_at_pc.bin", "wb"))
out:setvbuf("no")
local meta = io.open(os.getenv("PC_META") or "state_at_pc.txt", "w")
if meta then meta:setvbuf("no") end

-- Mirrors hardware.json "stateRegions" AND boards/pooyan/memory.js dumpState() order.
local REGIONS = {
  { 0x8000, 0x83FF, "color" },
  { 0x8400, 0x87FF, "video" },
  { 0x8800, 0x8FFF, "work" },
  { 0x9000, 0x90FF, "sprite0" },
  { 0x9400, 0x94FF, "sprite1" }
}

_G.__pc_done = false
_G.__pc_tap = sp:install_read_tap(target, target, "pc_exact", function(offset, data, mask)
  -- CURPC IS LOAD-BEARING: the boot self-check reads ROM bytes, so for many addresses the FIRST
  -- tap hit is a data read whose state would be captured instead of the routine's opcode fetch.
  if cpu.state["CURPC"].value ~= target then return data end
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
      target, data, secs, secs * 3072000))
    for _, rn in ipairs({ "AF", "BC", "DE", "HL", "IX", "IY", "SP" }) do
      local ok, v = pcall(function() return cpu.state[rn].value end)
      if ok and v ~= nil then meta:write(string.format("reg_%s=0x%04X\n", rn, v)) end
    end
  end
  return data
end)
