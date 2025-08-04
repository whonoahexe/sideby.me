export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export const FEATURE_FLAGS = {
  SUBTITLES_SUPPORT: true,
} as const;

export function isEnabled(flag: FeatureFlag): boolean {
  const envKey = `NEXT_PUBLIC_FF_${flag}`;
  const value = process.env[envKey];

  return value === 'true';
}

// debugging utility to log all feature flags
export function getAllFeatureFlags(): Record<FeatureFlag, boolean> {
  const flags: FeatureFlag[] = ['SUBTITLES_SUPPORT'];

  return flags.reduce(
    (acc, flag) => {
      acc[flag] = isEnabled(flag);
      return acc;
    },
    {} as Record<FeatureFlag, boolean>
  );
}
