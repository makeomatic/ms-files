async function tagFile(fileData) {
  const { amqp, config: { process: processConfig } } = this;
  const { files, username, bucket, uploadId } = fileData;
  const file = files.find(file => file.type === 'c-preview');

  if (file === undefined) {
    return false;
  }

  await amqp.publish(
    `${processConfig.prefix}.${processConfig.postfix.annotate}`,
    { filename: file.filename, username, bucket, uploadId }
  );

  return true;
}

module.exports = tagFile;
