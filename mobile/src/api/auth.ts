import { apiClient, LOGIN_PATH } from "@/api/client";
import type { LoginResponse } from "@/types/auth";

export async function login(cpf: string, senha: string): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>(LOGIN_PATH, {
    cpf,
    senha,
  });
  return response.data;
}

export async function changePassword(idFlanel: number, novaSenha: string): Promise<void> {
  await apiClient.put(`/api/flanelinha/${idFlanel}/senha`, { novaSenha });
}
