import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig, AxiosResponse } from "axios";
import { config } from "../config/env";

// Log configuration for debugging
console.log("API Client Configuration:", {
  baseUrl: config.api.baseUrl,
  useNgrok: config.api.useNgrok,
  ngrokUrl: config.api.ngrokUrl,
  localUrl: config.api.localUrl,
});

// Create a custom axios instance
const apiClient = axios.create({
  baseURL: config.api.baseUrl,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor for adding auth token or other headers
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    console.log(
      `API Request: ${config.method?.toUpperCase()} ${config.baseURL}${
        config.url
      }`,
      config.data
    );
    return config;
  },
  (error: AxiosError) => {
    console.error("API Request Error:", error.message);
    return Promise.reject(error);
  }
);

// Response interceptor for handling common errors
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(
      `API Response: ${response.status} for ${response.config.url}`,
      response.data
    );
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;
      const url = error.config?.url || "unknown endpoint";

      if (status === 401) {
        console.error(`Authentication error for ${url}:`, error.response.data);
      } else if (status === 403) {
        console.error(`Permission denied for ${url}:`, error.response.data);
      } else if (status === 404) {
        console.error(`Resource not found for ${url}:`, error.response.data);
      } else if (status >= 500) {
        console.error(`Server error for ${url}:`, error.response.data);
      }
    } else if (error.request) {
      console.error("Network error - No response received:", error.message);
      console.error("Request details:", {
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL,
      });
    } else {
      console.error("Request configuration error:", error.message);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
