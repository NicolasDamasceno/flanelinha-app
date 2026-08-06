import qrcode from "qrcode-generator";

// A codificação padrão da lib é Latin-1 (charCodeAt & 0xff), que corrompe acentos
// silenciosamente. `stringToBytesFuncs["UTF-8"]` (o mecanismo de troca de encoder documentado
// pela lib) só existe no build CJS (dist/qrcode.js) — o Metro resolve este import para o build
// ESM (dist/qrcode.mjs) via a condição "import" do exports map do pacote, onde esse mapa não
// existe, deixando `stringToBytesFuncs` undefined em runtime. Por isso a codificação UTF-8 é
// implementada aqui diretamente, sem depender de qual build foi resolvido.
function stringToUtf8Bytes(value: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i++) {
    const codePoint = value.codePointAt(i)!;
    if (codePoint > 0xffff) {
      i++; // par substituto consumido
    }
    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    }
  }
  return bytes;
}

qrcode.stringToBytes = stringToUtf8Bytes;

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
