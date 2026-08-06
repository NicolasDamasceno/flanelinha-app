import type { CarterinhaDto } from "@/types/flanelinha";

export function getCarteiraAtual(carterinhas: CarterinhaDto[]): CarterinhaDto | null {
  if (carterinhas.length === 0) {
    return null;
  }
  return [...carterinhas].sort(
    (a, b) => new Date(b.dataEmissao).getTime() - new Date(a.dataEmissao).getTime()
  )[0];
}

export function isCarteiraVencida(carteira: CarterinhaDto): boolean {
  return new Date(carteira.dataValidade).getTime() <= Date.now();
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function formatNumeroCarteira(numero: number): string {
  return `#${String(numero).padStart(6, "0")}`;
}
