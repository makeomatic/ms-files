-- this lua scripts marks uploaded item as processed
-- script is used to avoid race condition when marking it as finished

-- keys we'll be using
local uploadKey = KEYS[1]
local postActionKey = KEYS[2]
local partOfUploadFileKey = KEYS[3]

-- args
local uploadedAt = ARGV[1]
local statusField = ARGV[2]
local statusUploaded = ARGV[3]
local statusPending = ARGV[4]
local uploadedField = ARGV[5]
local fields = cjson.decode(ARGV[6])

-- retrieve current status
local currentStatus = redis.call('hget', partOfUploadFileKey, statusField)

-- verify that it is still in status pending
if currentStatus ~= statusPending then
  -- already processed error
  return redis.error_reply('409')
end

-- set status uploaded
redis.call('hmset', partOfUploadFileKey, 'uploadedAt', uploadedAt, statusField, statusUploaded)

-- increment counter of uploaded files
local fieldCount = redis.call('hincrby', uploadKey, uploadedField, 1)

-- now retrieve information we need
local returnFields = redis.call('hmget', uploadKey, unpack(fields))

-- deterimine if we have post actions
local hasPostActions = redis.call('exists', postActionKey)

-- returns [[...fields],fieldCount<Integer>,hasPostActions<integer>]
return {returnFields,fieldCount,hasPostActions}
