// backend/utils/textSimilarity.js
//
// Simple, dependency-free text similarity for FR3-09 (Correlation Suggestions).
// Uses Jaccard similarity over tokenized words — good enough to catch incidents
// with clearly overlapping titles/descriptions without pulling in an NLP library.

const tokenize = (str) => {
  return new Set(
    String(str || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ') // strip punctuation
      .split(/\s+/)
      .filter((word) => word.length > 2) // drop tiny/noise words (a, to, is, ...)
  );
};

/**
 * Returns a similarity score from 0 (no overlap) to 1 (identical token sets).
 */
const textSimilarity = (a, b) => {
  const setA = tokenize(a);
  const setB = tokenize(b);

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

module.exports = { textSimilarity };