const config = {
  prefix: 'nft',
  action: {
    persist: 'token.persist',
  },
};

const isDigitOnly = /[0-9]*/;
const UINT_MIN_LENGTH = 21;

async function notifyService(fileData) {
  const { amqp } = this;
  const { owner, uploadId } = fileData;

  if (UINT_MIN_LENGTH <= owner.length && isDigitOnly.test(owner)) {
    await amqp.publish(`${config.prefix}.${config.action.persist}`, { owner, uploadId });
  }

  return true;
}

module.exports = notifyService;
