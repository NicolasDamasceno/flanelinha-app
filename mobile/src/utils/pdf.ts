import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { DisplayableError } from "@/api/client";
import { getQrMatrix } from "@/utils/qrcode";
import { colors } from "@/theme/colors";
import { formatDate, formatNumeroCarteira } from "@/utils/carteira";
import type { CarterinhaDto } from "@/types/flanelinha";

interface CarteiraPdfData {
  nome: string;
  cpf: string;
  pontoAtuacao: string;
  fotoBase64: string | null;
  carteira: CarterinhaDto;
}

function qrMatrixToHtml(value: string, moduleSizePx: number): string {
  const matrix = getQrMatrix(value);
  const rows = matrix
    .map(
      (row) =>
        `<div style="display:flex;">${row
          .map(
            (isDark) =>
              `<div style="width:${moduleSizePx}px;height:${moduleSizePx}px;background:${
                isDark ? colors.text : colors.background
              };"></div>`
          )
          .join("")}</div>`
    )
    .join("");
  return `<div style="display:inline-block;padding:${moduleSizePx * 4}px;background:${colors.background};">${rows}</div>`;
}

function formatCpf(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildCardHtml(data: CarteiraPdfData): string {
  const fotoHtml = data.fotoBase64
    ? `<img src="data:image/jpeg;base64,${data.fotoBase64}" style="width:88px;height:88px;border-radius:44px;object-fit:cover;" />`
    : `<div style="width:88px;height:88px;border-radius:44px;background:${colors.border};"></div>`;

  return `
    <html>
      <body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Roboto,sans-serif;">
        <div style="width:520px;border:2px solid ${colors.primary};border-radius:16px;padding:20px;box-sizing:border-box;">
          <div style="font-size:11px;letter-spacing:1.5px;color:${colors.textMuted};text-transform:uppercase;font-weight:700;text-align:center;border-bottom:1px solid ${colors.border};padding-bottom:10px;margin-bottom:14px;">
            Carteira de Flanelinha
          </div>
          <div style="display:flex;justify-content:center;margin-bottom:10px;">${fotoHtml}</div>
          <div style="text-align:center;font-size:19px;font-weight:700;color:${colors.text};margin-bottom:14px;">
            ${escapeHtml(data.nome)}
          </div>
          <div style="display:flex;justify-content:space-around;margin-bottom:12px;">
            <div style="text-align:center;">
              <div style="font-size:10px;color:${colors.textMuted};text-transform:uppercase;">Número</div>
              <div style="font-size:13px;font-weight:600;color:${colors.text};">${formatNumeroCarteira(data.carteira.numeroCarterinha)}</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:10px;color:${colors.textMuted};text-transform:uppercase;">Validade</div>
              <div style="font-size:13px;font-weight:600;color:${colors.text};">${formatDate(data.carteira.dataValidade)}</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:10px;color:${colors.textMuted};text-transform:uppercase;">Ponto de Atuação</div>
              <div style="font-size:13px;font-weight:600;color:${colors.text};">${escapeHtml(data.pontoAtuacao)}</div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px dashed ${colors.border};">
            <span style="font-size:12px;color:${colors.text};font-weight:600;">CPF ${escapeHtml(formatCpf(data.cpf))}</span>
            ${qrMatrixToHtml(String(data.carteira.numeroCarterinha), 4)}
          </div>
        </div>
      </body>
    </html>
  `;
}

// A4 a 72 PPI (o padrão do expo-print, sem PPI configurável) — 210×297mm ≈ 595×842px. Sem isso,
// printToFileAsync usa o tamanho padrão da lib (US Letter, 612×792), não A4.
const A4_WIDTH_PX = 595;
const A4_HEIGHT_PX = 842;

export async function exportCarteiraPdf(data: CarteiraPdfData): Promise<void> {
  const html = buildCardHtml(data);
  const { uri } = await Print.printToFileAsync({ html, width: A4_WIDTH_PX, height: A4_HEIGHT_PX });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new DisplayableError("Não foi possível compartilhar o PDF neste dispositivo.");
  }
  await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
}
