import { defineModuleManifest } from "../../platform/module-contract";

export const manifest = defineModuleManifest({
  slug: "visual-builder",
  name: "Visual-Builder",
  description: "Erstellt Werbemittel in 1:1, 1.91:1 und 1:1.91 aus Motiven, Text, Logo und Button, mit Übersetzung, CI-Prüfung und Archiv.",
  version: "1.0.0",
  category: "tools",
  navigation: [{
    label: "Visual-Builder",
    path: "/visual-builder",
    icon: "canvas",
    section: "tools",
    order: 120,
    requiredCapability: "visual-builder.read",
  }],
  routes: [{
    path: "/visual-builder",
    match: "prefix",
    requiredCapability: "visual-builder.read",
    load: () => import("./view").then(({ VisualBuilderView }) => ({ default: VisualBuilderView })),
  }],
  capabilities: [
    "visual-builder.read",
    "visual-builder.create",
    "visual-builder.upload",
    "visual-builder.configure",
    "visual-builder.delete",
  ],
  emits: [],
  consumes: [],
  dataPorts: [],
  degradesTo: {
    mode: "limited",
    message: "Ohne verbundene Bildbibliothek können Motive nur nach Einrichtung gewählt werden.",
    missingValue: "—",
  },
  defaultEnabled: false,
  customerVisibleByDefault: false,
});
