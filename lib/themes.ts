/** Visual themes — layout/format stay fixed; only look-and-feel changes. */
export type ThemeId =
  | "default"
  | "light"
  | "dark"
  | "futuristic"
  | "lucky";

/** Five randomized looks used by Feeling Lucky. */
export type FeelingLuckyLookId =
  | "lucky-brass"
  | "lucky-ember"
  | "lucky-slate"
  | "lucky-forest"
  | "lucky-sand";

export type ConcreteThemeId =
  | Exclude<ThemeId, "lucky">
  | FeelingLuckyLookId;

export const THEME_OPTIONS: ReadonlyArray<{
  id: ThemeId;
  label: string;
  description: string;
}> = [
  {
    id: "default",
    label: "Theme Default",
    description: "Original dashboard theme",
  },
  {
    id: "light",
    label: "Theme 1: Light",
    description: "Lighter dashboard surfaces",
  },
  {
    id: "dark",
    label: "Theme 2: Dark",
    description: "Graphite steel / ops-black look",
  },
  {
    id: "futuristic",
    label: "Theme 3: Futuristic",
    description: "Cool cyan defense motifs",
  },
  {
    id: "lucky",
    label: "Theme 4: Feeling Lucky",
    description: "Randomizes among 5 distinct looks",
  },
];

/** Feeling Lucky rolls into one of these five concrete looks. */
export const LUCKY_THEME_POOL: readonly FeelingLuckyLookId[] = [
  "lucky-brass",
  "lucky-ember",
  "lucky-slate",
  "lucky-forest",
  "lucky-sand",
] as const;

export const FEELING_LUCKY_LOOK_LABELS: Record<FeelingLuckyLookId, string> = {
  "lucky-brass": "Brass",
  "lucky-ember": "Ember",
  "lucky-slate": "Slate",
  "lucky-forest": "Forest",
  "lucky-sand": "Sand",
};

export function isThemeId(value: string): value is ThemeId {
  return THEME_OPTIONS.some((option) => option.id === value);
}

export function isFeelingLuckyLookId(value: string): value is FeelingLuckyLookId {
  return (LUCKY_THEME_POOL as readonly string[]).includes(value);
}

export function isConcreteThemeId(value: string): value is ConcreteThemeId {
  if (value === "lucky") return false;
  return (
    isThemeId(value) ||
    isFeelingLuckyLookId(value)
  );
}

export function resolveThemeId(
  themeId: ThemeId,
  random: () => number = Math.random,
): ConcreteThemeId {
  if (themeId !== "lucky") return themeId;
  const index = Math.floor(random() * LUCKY_THEME_POOL.length);
  return LUCKY_THEME_POOL[index] ?? "lucky-brass";
}
