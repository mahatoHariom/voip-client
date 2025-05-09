import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig, AxiosResponse } from "axios";
import { config } from "../config/env";

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
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling common errors
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;

      if (status === 401) {
        console.error("Authentication error:", error.response.data);
      } else if (status === 403) {
        console.error("Permission denied:", error.response.data);
      } else if (status === 404) {
        console.error("Resource not found:", error.response.data);
      } else if (status >= 500) {
        console.error("Server error:", error.response.data);
      }
    } else if (error.request) {
      console.error("Network error:", error.message);
    } else {
      console.error("Request error:", error.message);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
