import axios from "axios";
import { getCurrentToken, triggerUnauthorized } from "@/context/authStore";

export const LOGIN_PATH = "/api/auth/login";

export const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

apiClient.interceptors.request.use((config) => {
  if (config.url !== LOGIN_PATH) {
    const token = getCurrentToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      error.config?.url !== LOGIN_PATH
    ) {
      triggerUnauthorized();
    }
    return Promise.reject(error);
  }
);

const GENERIC_CONNECTION_ERROR = "Não foi possível conectar. Tente novamente.";

export class DisplayableError extends Error {}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof DisplayableError) {
    return error.message;
  }

  if (!axios.isAxiosError(error) || !error.response) {
    return GENERIC_CONNECTION_ERROR;
  }

  if (error.response.status >= 500) {
    return GENERIC_CONNECTION_ERROR;
  }

  const data: unknown = error.response.data;

  if (typeof data === "string") {
    return data;
  }

  if (data && typeof data === "object" && "errors" in data) {
    const errors = (data as { errors?: unknown }).errors;
    if (errors && typeof errors === "object") {
      const firstField = Object.values(errors as Record<string, unknown>)[0];
      if (Array.isArray(firstField) && firstField.length > 0 && typeof firstField[0] === "string") {
        return firstField[0];
      }
    }
  }

  return GENERIC_CONNECTION_ERROR;
}
