export type Fmt = "1x1" | "191x1" | "1x191";
export type Align = "left" | "center" | "right";
export type Rect = { x_pct: number; y_pct: number; w_pct: number; h_pct: number };
export type Point = { x_pct: number; y_pct: number };
export type Crop = { x: number; y: number; zoom: number };
/** Cut-out figure: horizontal centre and bottom edge in % of the canvas, height in % of the canvas height. */
/** `rotate` in degrees around the centre of the figure. */
export type FigureBox = { x_pct: number; bottom_pct: number; h_pct: number; flip: boolean; rotate?: number };
export type CtaPlacement = "none" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
export type LogoPlacement = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center";
export type Locale = "de" | "en";

export type TextBlock = {
  html: string;
  rect: Rect;
  align: Align;
  color: string;
  /** Font size in % of canvas height, independent of the box size. */
  sizePct: number;
  /** Line spacing as a multiple of the font size. */
  lineHeight: number;
  /** Font family of the whole box; spans may override it. Falls back to the editor font. */
  font?: string;
  /** Rounded box hugging the text, e.g. a headline box with a white outline. */
  frame?: TextFrame | null;
};

export type TextFrame = { border: string; fill: string | null };

export type PerFormat<T> = Record<Fmt, T>;

/** tag: slanted label · arrow: chevrons plus arrow bar · pill: rounded button · outline: rounded with border. */
export type CtaShape = "tag" | "arrow" | "pill" | "outline";
export type CtaStyle = { bg_color?: string | null; text_color?: string | null; font_family?: string | null; shape?: CtaShape | null; border_color?: string | null };

export type PaletteColor = { name: string; hex: string };
/** Brand setup of a tenant: fonts per text role, default colours and the colour palette offered everywhere. */
export type Brand = {
  headlineFont: string | null;
  bodyFont: string | null;
  headlineColor: string | null;
  bodyColor: string | null;
  palette: PaletteColor[];
};

export type BadgeShape = "price-box" | "diamond" | "burst" | "circle" | "box";
export type BadgeSize = "xl" | "l" | "m" | "s";
/** `**…**` in the text is bold, `~~…~~` a small struck-through addition (e.g. an old price). */
export type BadgeLine = { text: string; size: BadgeSize; strike: boolean; bold?: boolean };
export type BadgeColors = { bg: string; fg: string; accentBg: string; accentFg: string; border: string };
/** A badge template from the settings (price box, diamond, starburst …). */
export type BadgeAsset = { id: string; name: string; shape: BadgeShape; lines: BadgeLine[]; colors: BadgeColors };
/** A badge placed in a creative; it carries shape and colours, so archived projects survive template changes. */
export type BadgeItem = {
  uid: string;
  name: string;
  shape: BadgeShape;
  colors: BadgeColors;
  lines: BadgeLine[];
  /** Top-left corner in % of the canvas. */
  pos: Point;
  /** Width in % of the shorter canvas side. */
  scale: number;
};

export type LogoAsset = { id: string; name: string; variant: "square" | "wide"; url: string };
export type CtaAsset = {
  id: string;
  name: string;
  variant: "text" | "graphic";
  text: string | null;
  style: CtaStyle;
  url: string | null;
};
export type FontAsset = { id: string; name: string; family: string; weight: number; style: "normal" | "italic"; url: string };
export type ExampleAsset = { id: string; name: string; url: string; width: number; height: number; cutout: boolean };
export type Language = { id: string; code: string; label: string; active: boolean };
export type Library = { id: string; label: string; folderId: string };

export type Violation = { rule: string; message: string };

export type BuilderCapabilities = {
  create: boolean;
  upload: boolean;
  configure: boolean;
  delete: boolean;
};

export type Bootstrap = {
  capabilities: BuilderCapabilities;
  driveConfigured: boolean;
  /** Only for people who may configure: the address folders must be shared with. */
  driveServiceAccount: string | null;
  driveCanCreateFolders: boolean;
  defaultFont: string | null;
  brand: Brand;
  languages: Language[];
  logos: LogoAsset[];
  ctas: CtaAsset[];
  badges: BadgeAsset[];
  stickers: StickerAsset[];
  fonts: FontAsset[];
  examples: ExampleAsset[];
  safeZones: Partial<Record<Fmt, Rect>>;
  libraries: Library[];
  hasGuidelines: boolean;
};

export type DriveImage = {
  id: string;
  name: string;
  folder: string;
  width: number;
  height: number;
  thumb: string | null;
  override: Fmt | null;
};

export type DriveListing = {
  configured: boolean;
  images: DriveImage[];
  error: string | null;
};

export type CreativeState = {
  v: 1;
  blocks: PerFormat<[TextBlock, TextBlock]>;
  bgPaths: PerFormat<string | null>;
  bgCrop: PerFormat<Crop>;
  bgColor?: string | null;
  figurePaths?: PerFormat<string | null>;
  figure?: PerFormat<FigureBox>;
  fontFamily: string;
  logoId: PerFormat<string | null>;
  logoPlacement: PerFormat<LogoPlacement>;
  logoPos: PerFormat<Point | null>;
  logoScale: PerFormat<number>;
  ctaId: PerFormat<string | null>;
  ctaPlacement: PerFormat<CtaPlacement>;
  ctaPos: PerFormat<Point | null>;
  ctaScale: PerFormat<number>;
  ctaText: PerFormat<string>;
  badges?: PerFormat<BadgeItem[]>;
  stickers?: PerFormat<StickerItem[]>;
  selectedLanguage: string;
  individual: PerFormat<boolean>;
  libraryId?: string | null;
};

/** draft: never checked; flagged: checked with findings, downloadable but not signed off; null: taken over from the previous tool. */
export type GuidelineStatus = "draft" | "flagged" | "approved" | null;

export type ArchiveEntry = {
  id: string;
  sourceText: string;
  languageCode: string | null;
  guidelineStatus: GuidelineStatus;
  hasState: boolean;
  createdAt: string;
  thumbs: Partial<Record<Fmt, string>>;
  zipUrl: string | null;
};

/** Decorative image (leaves, arrows) uploaded per tenant. */
export type StickerAsset = { id: string; name: string; url: string };

/** A placed sticker: centre in % of the canvas, width in % of the shorter side, rotation in degrees. */
export type StickerItem = {
  uid: string;
  assetId: string;
  name: string;
  x_pct: number;
  y_pct: number;
  scale: number;
  rotate: number;
  flip: boolean;
  /** Drawn behind the cut-out figure instead of in front of it. */
  behind: boolean;
};
