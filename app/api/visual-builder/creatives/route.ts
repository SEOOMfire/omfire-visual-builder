import { NextResponse } from "next/server";
import { rejectCrossSiteMutation } from "../../../../src/platform/http/mutation-origin";
import { visualBuilderApiError, visualBuilderPrincipal } from "../../../../src/modules/visual-builder/server/api";
import { listCreatives, saveCreative, type SaveCreativeInput } from "../../../../src/modules/visual-builder/server/service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const principal = await visualBuilderPrincipal();
    return NextResponse.json({ creatives: await listCreatives(principal) });
  } catch (error) {
    return visualBuilderApiError(request, error, "visual-builder.archive");
  }
}

export async function POST(request: Request) {
  const originRejection = rejectCrossSiteMutation(request);
  if (originRejection) return originRejection;
  try {
    const principal = await visualBuilderPrincipal();
    const body = await request.json().catch(() => ({})) as SaveCreativeInput;
    return NextResponse.json(await saveCreative(principal, body), { status: 201 });
  } catch (error) {
    return visualBuilderApiError(request, error, "visual-builder.archive.save");
  }
}
