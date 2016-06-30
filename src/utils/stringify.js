module.exports = function stringify(data, field) {
  const datum = data[field];
  if (datum) {
    data[field] = JSON.stringify(datum);
  }
};
