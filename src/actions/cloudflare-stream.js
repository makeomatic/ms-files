const { ActionTransport } = require('@microfleet/plugin-router');
const { HttpStatusError } = require('common-errors');

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

  const { status, uid } = parseBodyJson(body);

  if (status.state === STATUS_STATE_READY) {
    await this.dispatch('finish', {
      params: {
        filename: CloudflareStreamTransport.filenameWithPrefix(uid),
      },
    });
  }

  // @todo handle status.state === error

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
