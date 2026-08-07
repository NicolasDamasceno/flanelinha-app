import type { CarterinhaDto } from "@/types/flanelinha";

export function getCarteiraAtual(carterinhas: CarterinhaDto[]): CarterinhaDto | null {
  const ativas = carterinhas.filter((c) => c.ativo);
  if (ativas.length === 0) {
    return null;
  }
  return [...ativas].sort(
    (a, b) => new Date(b.dataEmissao).getTime() - new Date(a.dataEmissao).getTime()
  )[0];
}

export function isCarteiraVencida(carteira: CarterinhaDto): boolean {
  return new Date(carteira.dataValidade).getTime() <= Date.now();
}

// Formatação manual (não `toLocaleDateString`) porque o Hermes em Release/produção nem sempre
// embute os dados de ICU para o locale "pt-BR" — nesse caso o resultado cai silenciosamente pro
// formato padrão (ex. M/D/AAAA), sem erro, mostrando uma data errada na carteirinha.
export function formatDate(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

export function formatNumeroCarteira(numero: number): string {
  return `#${String(numero).padStart(6, "0")}`;
}
