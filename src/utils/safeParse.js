// returns original value if it was found
module.exports = function safeParse(data, returnValue) {
  try {
    return JSON.parse(data);
  } catch (e) {
    return returnValue || data;
  }
};
