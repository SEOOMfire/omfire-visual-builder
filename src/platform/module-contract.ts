export type Capability = `${string}.${string}`;

export type ModuleCategory = "operate" | "data" | "intelligence" | "tools" | "admin";
export type NavigationSection = "home" | "operate" | "act" | "control" | "data" | "intelligence" | "tools" | "admin";
export type NavigationIcon = "canvas" | "settings" | "home";

export interface NavEntry {
  label: string;
  path: `/${string}` | "/";
  icon: NavigationIcon;
  section: NavigationSection;
  order: number;
  requiredCapability?: Capability;
}

export interface RouteDefinition {
  path: `/${string}` | "/";
  load: () => Promise<{ default: unknown }>;
  match?: "exact" | "prefix";
  requiredCapability?: Capability;
}

export interface ModuleManifest {
  slug: string;
  name: string;
  description: string;
  version: string;
  category: ModuleCategory;
  navigation: readonly NavEntry[];
  routes: readonly RouteDefinition[];
  capabilities: readonly Capability[];
  emits: readonly unknown[];
  consumes: readonly unknown[];
  dataPorts: readonly unknown[];
  degradesTo?: { mode: "limited" | "unavailable" | "hidden"; message: string; missingValue?: "—" };
  defaultEnabled: boolean;
  customerVisibleByDefault: boolean;
}

export function defineModuleManifest<const T extends ModuleManifest>(manifest: T): T {
  return manifest;
}
