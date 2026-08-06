import { apiClient } from "@/api/client";
import type { CarterinhaDto, CreateFlanelinhaDto, FlanelinhaDto, UpdateFlanelinhaDto } from "@/types/flanelinha";
import type { FlanelinhaPerfil } from "@/types/auth";

export async function listFlanelinhas(): Promise<FlanelinhaDto[]> {
  const response = await apiClient.get<FlanelinhaDto[]>("/api/flanelinha");
  return response.data;
}

export async function getFlanelinha(id: number): Promise<FlanelinhaDto> {
  const response = await apiClient.get<FlanelinhaDto>(`/api/flanelinha/${id}`);
  return response.data;
}

export async function createFlanelinha(dto: CreateFlanelinhaDto): Promise<FlanelinhaDto> {
  const response = await apiClient.post<FlanelinhaDto>("/api/flanelinha", dto);
  return response.data;
}

export async function updateFlanelinha(id: number, dto: UpdateFlanelinhaDto): Promise<FlanelinhaDto> {
  const response = await apiClient.put<FlanelinhaDto>(`/api/flanelinha/${id}`, dto);
  return response.data;
}

export async function deleteFlanelinha(id: number): Promise<void> {
  await apiClient.delete(`/api/flanelinha/${id}`);
}

export async function getMyFlanelinha(): Promise<FlanelinhaDto> {
  const response = await apiClient.get<FlanelinhaDto>("/api/flanelinha/me");
  return response.data;
}

export async function requestCarteira(id: number): Promise<CarterinhaDto> {
  const response = await apiClient.post<CarterinhaDto>(`/api/flanelinha/${id}/carteiras`, {});
  return response.data;
}

export async function updatePerfilFlanelinha(
  id: number,
  dto: { nome: string; email: string }
): Promise<FlanelinhaPerfil> {
  const response = await apiClient.put<FlanelinhaPerfil>(`/api/flanelinha/${id}/perfil`, dto);
  return response.data;
}

export async function changeFlanelinhaPassword(
  id: number,
  senhaAtual: string,
  novaSenha: string
): Promise<void> {
  await apiClient.put(`/api/flanelinha/${id}/senha`, { senhaAtual, novaSenha });
}
