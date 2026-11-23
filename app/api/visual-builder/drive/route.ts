import { NextResponse } from "next/server";
import { rejectCrossSiteMutation } from "../../../../src/platform/http/mutation-origin";
import { visualBuilderApiError, visualBuilderPrincipal } from "../../../../src/modules/visual-builder/server/api";
import { listLibraryImages, streamLibraryImage, uploadToLibrary } from "../../../../src/modules/visual-builder/server/service";

export const runtime = "nodejs";
export const maxDuration = 120;

/** `?library=<id>` lists the motifs, `?image=<driveFileId>` streams one same-origin. */
export async function GET(request: Request) {
  try {
    const principal = await visualBuilderPrincipal();
    const params = new URL(request.url).searchParams;
    const image = params.get("image");
    if (image) return await streamLibraryImage(principal, image);
    return NextResponse.json(await listLibraryImages(principal, params.get("library")));
  } catch (error) {
    return visualBuilderApiError(request, error, "visual-builder.drive");
  }
}

export async function POST(request: Request) {
  const originRejection = rejectCrossSiteMutation(request);
  if (originRejection) return originRejection;
  try {
    const principal = await visualBuilderPrincipal();
    return NextResponse.json(await uploadToLibrary(principal, await request.formData()), { status: 201 });
  } catch (error) {
    return visualBuilderApiError(request, error, "visual-builder.drive.upload");
  }
}
