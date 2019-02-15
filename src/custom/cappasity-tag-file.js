async function tagFile(fileData) {
  const { amqp, config: { process: processConfig } } = this;
  const { files, username, bucket, uploadId } = fileData;
  const filename = files.some(file => file.type === 'c-preview');

  if (filename === undefined) {
    return false;
  }

  await amqp.publish(
    `${processConfig.prefix}.${processConfig.postfix.annotate}`,
    { filename, username, bucket, uploadId }
  );

  return true;
}

module.exports = tagFile;
