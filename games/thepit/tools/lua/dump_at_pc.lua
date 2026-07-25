-- SPDX-License-Identifier: GPL-3.0-only
-- PC-exact state capture for The Pit (game #2). Adapted from games/dkong/tools/lua/
-- dump_at_pc.lua -- a read tap on one ROM address fires when it is FETCHED (no -debug
-- needed); state is sampled BEFORE that instruction runs. Same 4352-byte state format
-- as dump_state.lua. Env: PC_TARGET (default 0x01A4, the boot entry), STATE_OUT, PC_META.

local sp = manager.machine.devices[":maincpu"].spaces["program"]
local target = tonumber(os.getenv("PC_TARGET") or "0x01A4")

local cfgf = io.open(os.getenv("CONFIG_OUT") or "config.txt", "w")
if cfgf then
  cfgf:setvbuf("no")
  cfgf:write(string.format("dsw0=0x%02X\ncontrol_rom0000=0x%02X\n",
    sp:read_u8(0xB000), sp:read_u8(0x0000)))
  local cpu = manager.machine.devices[":maincpu"]
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

local REGIONS = {
  { 0x8000, 0x87FF }, -- work
  { 0x8800, 0x8BFF }, -- colour
  { 0x9000, 0x93FF }, -- video
  { 0x9800, 0x98FF }, -- attribute + sprite
}

_G.__pc_done = false
_G.__pc_tap = sp:install_read_tap(target, target, "pc_exact", function(offset, data, mask)
  if _G.__pc_done then return data end
  _G.__pc_done = true
  local parts = {}
  for _, r in ipairs(REGIONS) do
    for a = r[1], r[2] do parts[#parts + 1] = string.char(sp:read_u8(a)) end
  end
  out:write(table.concat(parts))
  if meta then
    local secs = manager.machine.time:as_double()
    meta:write(string.format("pc=0x%04X\nopcode_byte=0x%02X\nseconds=%.9f\ncycles=%.0f\n",
      target, data, secs, secs * 3072000))
  end
  return data
end)
