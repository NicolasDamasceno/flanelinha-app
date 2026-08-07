import { apiClient } from "@/api/client";
import type { FiscalPerfil } from "@/types/auth";

export async function updateFiscalPerfil(
  id: number,
  dto: { nome: string; email: string }
): Promise<FiscalPerfil> {
  const response = await apiClient.put<FiscalPerfil>(`/api/fiscal/${id}/perfil`, dto);
  return response.data;
}

export async function changeFiscalPassword(
  id: number,
  senhaAtual: string,
  novaSenha: string
): Promise<void> {
  await apiClient.put(`/api/fiscal/${id}/senha`, { senhaAtual, novaSenha });
}
