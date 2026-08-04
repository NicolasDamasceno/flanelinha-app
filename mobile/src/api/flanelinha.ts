import { apiClient } from "@/api/client";
import type { CreateFlanelinhaDto, FlanelinhaDto, UpdateFlanelinhaDto } from "@/types/flanelinha";

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
