module.exports = function stringify(data, field, _output) {
  const output = _output || data;
  const datum = data[field];

  if (datum) {
    output[field] = JSON.stringify(datum);
  }
};
