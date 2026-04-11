import { z } from 'zod';

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return value;
};

const optionalEnvSchema = z.object({
  VITE_APP_ORIGIN: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().url('VITE_APP_ORIGIN precisa ser uma URL valida.').optional(),
  ),
  VITE_SIAFI_CONTA_PAGADORA: z.string().trim().min(1).optional().default('408034'),
  VITE_SIAFI_MACRO_CODIGO_FINAL: z.string().trim().min(1).optional().default('2200'),
});

const requiredSupabaseEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().trim().url('VITE_SUPABASE_URL precisa ser uma URL valida.'),
  VITE_SUPABASE_ANON_KEY: z.string().trim().min(1, 'VITE_SUPABASE_ANON_KEY nao pode estar vazia.'),
});

const optionalEnv = optionalEnvSchema.parse(import.meta.env);

export const env = {
  appOrigin: optionalEnv.VITE_APP_ORIGIN ? new URL(optionalEnv.VITE_APP_ORIGIN).origin : undefined,
  siafiContaPagadora: optionalEnv.VITE_SIAFI_CONTA_PAGADORA,
  siafiMacroCodigoFinal: optionalEnv.VITE_SIAFI_MACRO_CODIGO_FINAL,
};

export function getSupabaseEnv() {
  const result = requiredSupabaseEnvSchema.safeParse(import.meta.env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');

    throw new Error(`Configuracao de ambiente do Supabase invalida. ${details}`);
  }

  return {
    url: result.data.VITE_SUPABASE_URL,
    anonKey: result.data.VITE_SUPABASE_ANON_KEY,
  };
}

export function getSupabaseFunctionUrl(functionName: string) {
  const { url } = getSupabaseEnv();
  return `${url}/functions/v1/${functionName}`;
}
