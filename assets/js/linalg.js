// Álgebra matricial mínima (vanilla JS) para matrices pequeñas (n <= ~15).
// Sin dependencias externas: suficiente para lo que necesita Markowitz.

const Linalg = (() => {
  function zeros(rows, cols) {
    return Array.from({ length: rows }, () => new Array(cols).fill(0));
  }

  function identity(n) {
    const m = zeros(n, n);
    for (let i = 0; i < n; i++) m[i][i] = 1;
    return m;
  }

  function transpose(A) {
    const rows = A.length, cols = A[0].length;
    const T = zeros(cols, rows);
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < cols; j++) T[j][i] = A[i][j];
    return T;
  }

  // Multiplica matriz x matriz, matriz x vector, o vector x matriz (vectores como arrays planos).
  function multiply(A, B) {
    const aIsVec = typeof A[0] === "number";
    const bIsVec = typeof B[0] === "number";
    const Am = aIsVec ? [A] : A;
    const Bm = bIsVec ? B.map((x) => [x]) : B;

    const rows = Am.length, inner = Bm.length, cols = Bm[0].length;
    const R = zeros(rows, cols);
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        let sum = 0;
        for (let k = 0; k < inner; k++) sum += Am[i][k] * Bm[k][j];
        R[i][j] = sum;
      }
    }
    if (aIsVec && bIsVec) return R[0][0];
    if (aIsVec) return R[0];
    if (bIsVec) return R.map((r) => r[0]);
    return R;
  }

  // Inversión por Gauss-Jordan con pivoteo parcial.
  function inverse(A) {
    const n = A.length;
    const M = A.map((row, i) => [...row, ...identity(n)[i]]);

    for (let col = 0; col < n; col++) {
      let pivotRow = col;
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(M[r][col]) > Math.abs(M[pivotRow][col])) pivotRow = r;
      }
      if (Math.abs(M[pivotRow][col]) < 1e-12) {
        throw new Error("Matriz singular o casi singular: no se puede invertir (¿activos con retornos idénticos?)");
      }
      [M[col], M[pivotRow]] = [M[pivotRow], M[col]];

      const pivot = M[col][col];
      for (let j = 0; j < 2 * n; j++) M[col][j] /= pivot;

      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const factor = M[r][col];
        for (let j = 0; j < 2 * n; j++) M[r][j] -= factor * M[col][j];
      }
    }
    return M.map((row) => row.slice(n));
  }

  function dot(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  function ones(n) {
    return new Array(n).fill(1);
  }

  return { zeros, identity, transpose, multiply, inverse, dot, ones };
})();
