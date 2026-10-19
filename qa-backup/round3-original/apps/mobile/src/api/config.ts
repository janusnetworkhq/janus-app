import { Platform } from "react-native";

function defaultApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (Platform.OS === "android") return "http://10.0.2.2:3000";
  return "http://localhost:3000";
}

export const apiConfig = {
  baseUrl: defaultApiUrl().replace(/\/$/, ""),
  authMode: (process.env.EXPO_PUBLIC_AUTH_MODE ?? "local") as "local" | "cognito",
  cognitoDomain: process.env.EXPO_PUBLIC_COGNITO_DOMAIN ?? "",
  cognitoClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID ?? "",
  cognitoRegion: process.env.EXPO_PUBLIC_COGNITO_REGION ?? "ap-south-1",
};
