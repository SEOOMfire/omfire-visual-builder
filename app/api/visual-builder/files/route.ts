import { NextResponse } from "next/server";
import { rejectCrossSiteMutation } from "../../../../src/platform/http/mutation-origin";
import { visualBuilderApiError, visualBuilderPrincipal } from "../../../../src/modules/visual-builder/server/api";
import { requireUuid, requireVisualBuilderCapability, VisualBuilderInputError } from "../../../../src/modules/visual-builder/server/access";
import { readModuleFile, storeUploadPart, UPLOAD_PART_MAX_BYTES } from "../../../../src/modules/visual-builder/server/files";
import { assetFileId, createAsset, CREATIVE_PARTS, creativeFileId, type CreativePart } from "../../../../src/modules/visual-builder/server/service";

export const runtime = "nodejs";

/** Same-origin delivery, so the editor canvas stays exportable. */
export async function GET(request: Request) {
  try {
    const principal = await visualBuilderPrincipal();
    const params = new URL(request.url).searchParams;
    const assetId = params.get("asset");
    const creativeId = params.get("creative");
    let fileId: string;
    let download = false;
    if (assetId) {
      fileId = await assetFileId(principal, assetId);
    } else if (creativeId) {
      const part = params.get("part") as CreativePart;
      if (!CREATIVE_PARTS.includes(part)) throw new VisualBuilderInputError("Die Datei ist ungültig.");
      fileId = await creativeFileId(principal, creativeId, part);
      download = part === "zip";
    } else {
      throw new VisualBuilderInputError("Die Datei ist ungültig.");
    }
    const file = await readModuleFile(principal, fileId);
    const headers: Record<string, string> = {
      "Content-Type": file.contentType,
      "Content-Length": String(file.bytes.byteLength),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    };
    if (download) headers["Content-Disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`;
    return new NextResponse(Buffer.from(file.bytes), { status: 200, headers });
  } catch (error) {
    return visualBuilderApiError(request, error, "visual-builder.files");
  }
}

/** Logos, buttons and fonts (multipart). */
export async function POST(request: Request) {
  const originRejection = rejectCrossSiteMutation(request);
  if (originRejection) return originRejection;
  try {
    const principal = await visualBuilderPrincipal();
    await createAsset(principal, await request.formData());
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return visualBuilderApiError(request, error, "visual-builder.assets");
  }
}

/** One part of a large archive export (raw body). */
export async function PUT(request: Request) {
  const originRejection = rejectCrossSiteMutation(request);
  if (originRejection) return originRejection;
  try {
    const principal = await visualBuilderPrincipal();
    requireVisualBuilderCapability(principal, "create");
    const params = new URL(request.url).searchParams;
    const uploadId = requireUuid(params.get("upload"), "Der Upload ist ungültig.");
    const part = Number(params.get("part"));
    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > UPLOAD_PART_MAX_BYTES) throw new VisualBuilderInputError("Der Upload-Teil ist zu groß.");
    await storeUploadPart(principal, uploadId, part, new Uint8Array(await request.arrayBuffer()));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return visualBuilderApiError(request, error, "visual-builder.upload-part");
  }
}
