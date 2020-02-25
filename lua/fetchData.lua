-- first key is redis hash key
-- we need to determine if it exists or not and if it does - return error
local key = KEYS[1]
local hashKeys = redis.call('hkeys', key)

-- no keys, doesnt exist
if next(hashKeys) == nil then
  return redis.error_reply('404');
end

local params
-- ARGV[1] could be a JSON object { omit: [], pick: []}
-- * we do not have whitelist, because we do not know what fields are actually there
-- * fields provided `omit` list automatically excluded from `pick` list.
-- * if no fields provided in `pick` list we use all fields from hash
-- * both fields are optional, so if they have type ne object We override them with defalt values
if type(ARGV[1]) == 'string' then params=cjson.decode(ARGV[1]) end

local omit = (type(params['omit']) == 'table' and params['omit'] or {})
local pick = (type(params['pick']) == 'table' and params['pick'] or hashKeys)

local filtered

if next(params) ~= nil then
  local omitTree = {}
  local pickTree = {}

  for _,field in pairs(omit) do
    omitTree[field] = true
  end

  for _,field in pairs(pick) do
    pickTree[field] = true
  end

  filtered = {}
  for _,field in pairs(hashKeys) do
    -- if field present in omit we exclude it from pick list
    if (omitTree[field] ~= true) and (pickTree[field] == true) then table.insert(filtered, field) end
  end
else
  filtered = hashKeys
end

-- no fields left
if #filtered == 0 then
  return { filtered, {} }
end

-- fetched data
local data = redis.call('hmget', key, unpack(filtered))

-- return 2 lists of keys & associated data
return {filtered, data};
