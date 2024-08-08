const { ActionTransport } = require('@microfleet/plugin-router');
const { HttpStatusError } = require('common-errors');
const stringify = require('safe-stable-stringify');

const { PROVIDER_CLOUDFLARE_MISSING_ERROR } = require('../constant');
const CloudflareStreamTransport = require('../providers/cloudflare-stream');

const malformedRequestError = new HttpStatusError(400, 'Malformed request');
const parseJsonError = new HttpStatusError(400, 'Parse body json error');

const STATUS_STATE_READY = 'ready';
const RESPONSE_OK = 'OK';

const parseBodyJson = (body) => {
  try {
    return JSON.parse(body);
  } catch (error) {
    throw parseJsonError;
  }
};

async function cloudflareWebhookAction(request) {
  const body = request.transportRequest.payload;
  const signature = request.headers['webhook-signature'];
  const provider = this.providersByAlias['cloudflare-stream'];

  if (!provider) {
    throw PROVIDER_CLOUDFLARE_MISSING_ERROR;
  }

  if (!signature || !body || !provider.validateWebhook(signature, body)) {
    throw malformedRequestError;
  }

  const message = parseBodyJson(body);
  const { status, uid } = message;

  if (status.state !== STATUS_STATE_READY) {
    this.log.error({ message }, 'failed cloudflare-stream webhook');

    return RESPONSE_OK;
  }

  const filename = CloudflareStreamTransport.filenameWithPrefix(uid);
  const { uploadId, owner } = await this.dispatch('finish', {
    params: {
      filename,
      await: true,
    },
  });

  await this.dispatch('update', {
    params: {
      uploadId,
      username: owner,
      meta: {
        [filename]: stringify({
          duration: message.duration,
          height: message.input.height,
          size: message.size,
          width: message.input.width,
        }),
      },
    },
  });

  return RESPONSE_OK;
}

cloudflareWebhookAction.schema = false;
cloudflareWebhookAction.transports = [ActionTransport.http];
cloudflareWebhookAction.transportOptions = {
  hapi: {
    method: 'POST',
    options: {
      payload: {
        output: 'data',
        parse: false,
      },
    },
  },
};
cloudflareWebhookAction.transportsOptions = {
  [ActionTransport.http]: {
    methods: ['post'],
  },
};

module.exports = cloudflareWebhookAction;
