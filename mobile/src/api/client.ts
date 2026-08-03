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

export function extractErrorMessage(error: unknown): string {
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
    const errors = (data as { errors: Record<string, string[]> }).errors;
    const firstField = Object.values(errors)[0];
    if (firstField && firstField.length > 0) {
      return firstField[0];
    }
  }

  return GENERIC_CONNECTION_ERROR;
}
