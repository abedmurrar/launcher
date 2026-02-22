import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

/**
 * Shared axios instance for app API calls (same-origin).
 * Uses interceptors for default headers and consistent error handling.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: typeof window !== "undefined" ? "" : undefined,
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  validateStatus: () => true, // always resolve; callers check response.status
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
      console.debug("[api]", config.method?.toUpperCase(), config.url);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
      const msg = error.response?.data?.error ?? error.message;
      console.debug("[api] error", error.response?.status, msg);
    }
    return Promise.reject(error);
  }
);

