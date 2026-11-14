declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_GROQ_API_KEY: string | undefined;
    readonly EXPO_PUBLIC_GEMINI_API_KEY: string | undefined;
  }
}
