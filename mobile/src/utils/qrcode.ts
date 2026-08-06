import qrcode from "qrcode-generator";

// A codificação padrão da lib é Latin-1 (charCodeAt & 0xff), que corrompe acentos
// silenciosamente. Optamos explicitamente por UTF-8.
qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];

/**
 * Codifica `value` como QR (nível de correção M) e retorna a matriz de módulos.
 * `matrix[row][col] === true` significa módulo escuro. A matriz é sempre quadrada.
 * Lança (string, não Error) se `value` exceder a capacidade máxima do QR.
 */
export function getQrMatrix(value: string): boolean[][] {
  const qr = qrcode(0, "M"); // typeNumber 0 = auto-detecta o menor tamanho necessário
  qr.addData(value);
  qr.make();

  const count = qr.getModuleCount();
  const matrix: boolean[][] = [];
  for (let row = 0; row < count; row++) {
    const rowValues: boolean[] = [];
    for (let col = 0; col < count; col++) {
      rowValues.push(qr.isDark(row, col));
    }
    matrix.push(rowValues);
  }
  return matrix;
}
