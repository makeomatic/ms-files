module.exports = function getEmbeddedInfo(info) {
  const { uploadId: id } = info;

  const code = '' +
    '<iframe' +
    ' width=“{{ width }}“' +
    ' height=“{{ height }}“' +
    ' allowfullscreen' +
    ' border="0"' +
    ` src="https://api.cappasity.com/api/player/${id}/embedded?autorun={{ autorun }}“ ` +
    '/>';

  return {
    code,
    params: {
      autorun: 0,
      width: 800,
      height: 800,
    },
  };
};
