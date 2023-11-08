/**
 * Contains normalization routine for file name
 * @param {string} name
 */
exports.normalizeForSearch = (name) => {
  return name.trim().toLowerCase().normalize('NFKC');
};
