// https://en.wikipedia.org/wiki/Wagner%E2%80%93Fischer_algorithm
function computeEditDistance(s, t) {
  let m = s.length;
  let n = t.length;

  let d = new Array(m + 1);
  for (let i = 0; i < m + 1; i++) {
    d[i] = new Array(n + 1);
    d[i][0] = i;
  }

  for (let j = 0; j < n + 1; j++) {
    d[0][j] = j;
  }

  for (let j = 1; j <= n; j++) {
    for (let i = 1; i <= m; i++) {
      if (s[i - 1] === t[j - 1]) {
        d[i][j] = d[i - 1][j - 1];
      } else {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + 1);
      }
    }
  }

  return d[m][n];
}

module.exports = computeEditDistance;
