import { NextResponse } from "next/server";
import { rejectCrossSiteMutation } from "../../../src/platform/http/mutation-origin";
import { visualBuilderApiError, visualBuilderPrincipal } from "../../../src/modules/visual-builder/server/api";
import { checkGuidelines, translateItems } from "../../../src/modules/visual-builder/server/ai";
import { VisualBuilderInputError } from "../../../src/modules/visual-builder/server/access";
import {
  addLibrary,
  createLibraryFolder,
  deleteAsset,
  deleteCreative,
  deleteLanguage,
  loadBootstrap,
  loadCreativeState,
  loadGuideline,
  removeLibrary,
  saveGuideline,
  saveLanguage,
  saveSafeZone,
  saveSettings,
  seedDefaultLanguages,
  setImageFormat,
  testLibrary,
} from "../../../src/modules/visual-builder/server/service";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  try {
    const principal = await visualBuilderPrincipal();
    const params = new URL(request.url).searchParams;
    if (params.get("view") === "guideline") return NextResponse.json(await loadGuideline(principal));
    if (params.get("creative")) return NextResponse.json({ state: await loadCreativeState(principal, params.get("creative")) });
    return NextResponse.json(await loadBootstrap(principal));
  } catch (error) {
    return visualBuilderApiError(request, error, "visual-builder.read");
  }
}

export async function POST(request: Request) {
  const originRejection = rejectCrossSiteMutation(request);
  if (originRejection) return originRejection;
  try {
    const principal = await visualBuilderPrincipal();
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.action !== "string") throw new VisualBuilderInputError("Die Anfrage ist ungültig.");
    switch (body.action) {
      case "translate":
        return NextResponse.json({ translations: await translateItems(principal, body) });
      case "check":
        return NextResponse.json(await checkGuidelines(principal, body));
      case "language.save":
        await saveLanguage(principal, body);
        break;
      case "language.delete":
        await deleteLanguage(principal, body.id);
        break;
      case "language.seed":
        await seedDefaultLanguages(principal);
        break;
      case "asset.delete":
        await deleteAsset(principal, body.id);
        break;
      case "guideline.save":
        await saveGuideline(principal, body);
        break;
      case "safe-zone.save":
        await saveSafeZone(principal, body);
        break;
      case "settings.save":
        await saveSettings(principal, body);
        break;
      case "library.add":
        return NextResponse.json(await addLibrary(principal, body));
      case "library.create":
        return NextResponse.json(await createLibraryFolder(principal, body));
      case "library.remove":
        await removeLibrary(principal, body.id);
        break;
      case "library.test":
        return NextResponse.json(await testLibrary(principal, body.id));
      case "image.format":
        await setImageFormat(principal, body);
        break;
      case "creative.delete":
        return NextResponse.json(await deleteCreative(principal, body.id));
      default:
        throw new VisualBuilderInputError("Die Anfrage ist ungültig.");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return visualBuilderApiError(request, error, "visual-builder.write");
  }
}
