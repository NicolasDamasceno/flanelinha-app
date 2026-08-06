import qrcode from "qrcode-generator";

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
