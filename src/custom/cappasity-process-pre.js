const Promise = require('bluebird');
const { HttpStatusError } = require('common-errors');
const debug = require('debug')('process-pre');
const {
  CAPPASITY_TYPE_MAP,
  FILES_OWNER_FIELD,
  UPLOAD_TYPE_CLOUDFLARE_STREAM,
} = require('../constant');

function parseMeta(data) {
  const parsedFiles = typeof data.files === 'string' ? JSON.parse(data.files) : data.files;
  const output = Object.create(null);

  let textures = 0;
  parsedFiles.forEach(({ type, filename }) => {
    if (data.uploadType === UPLOAD_TYPE_CLOUDFLARE_STREAM && type === 'video' && !output.preview) {
      output.preview = filename;
    }

    const responsibility = CAPPASITY_TYPE_MAP[type];

    /** skip for simple uploads */
    if (!responsibility) {
      return;
    }

    if (responsibility === 'texture') {
      output[`texture_${textures}`] = filename;
      textures += 1;
    } else {
      output[responsibility] = filename;
    }
  });

  // so that we don't parse it again later
  data.files = parsedFiles;

  debug('parseMeta -> %j', output);

  return output;
}

const lua = `
local balance = redis.call("hget", KEYS[1], ARGV[1]);
local roles = redis.call("hget", KEYS[1], "roles");
local isAdmin = roles and string.match(roles, '"admin"') or nil;

if tonumber(balance) < 1 and isAdmin == nil then
  return redis.error_reply("insufficient balance");
end

-- add exported property
local exported = redis.call("hsetnx", KEYS[2], ARGV[3], ARGV[4]);

-- if we dont have an admin account - subtract model
if isAdmin == nil and exported == 1 then
  return redis.call("hincrby", KEYS[1], ARGV[1], ARGV[2]);
end

-- return current amount of models for consistency
return redis.call("hget", KEYS[1], ARGV[1]);
`;

module.exports = function finishPost(props) {
  const { amqp, config } = this;
  const { updateMetadata, audience, exportAudience } = config.users;
  const { exported, sourceSHA } = props;

  if (exported || !props.export) {
    // do not charge if we have exported file
    return Promise.try(() => parseMeta(props));
  }

  if (!sourceSHA) {
    throw new HttpStatusError(412, 'source-sha256 must be provided');
  }

  // write down
  const exportedAt = Date.now().toString();
  const message = {
    username: props[FILES_OWNER_FIELD],
    audience: [audience, exportAudience],
    script: {
      balance: {
        lua,
        argv: ['models', '-1', sourceSHA, exportedAt],
      },
    },
  };

  // getMetadata
  return amqp
    .publishAndWait(updateMetadata, message)
    .then(() => {
      props.exported = exportedAt;
      return parseMeta(props);
    })
    .catch((e) => {
      if (e.message === 'insufficient balance') {
        throw new HttpStatusError(402, 'no more models are available');
      }

      throw e;
    });
};
