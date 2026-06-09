type ViteEnvLike = Record<string, unknown>;

function readViteEnv(): ViteEnvLike {
  const importMetaEnv = ((import.meta as { env?: ViteEnvLike }).env ?? {}) as ViteEnvLike;
  const processEnv = ((globalThis as { process?: { env?: ViteEnvLike } }).process?.env ?? {}) as ViteEnvLike;
  return {
    ...processEnv,
    ...importMetaEnv
  };
}

export function shouldShowMiniPilotPanel(env: ViteEnvLike = readViteEnv()): boolean {
  return env.VITE_SHOW_MINI_PILOT_PANEL === "1";
}
