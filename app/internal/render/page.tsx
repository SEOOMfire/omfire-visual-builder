import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { renderAuthorized } from "../../../src/modules/visual-builder/server/render-token";
import { RenderStage } from "./stage";

export const dynamic = "force-dynamic";

export default async function RenderPage({ searchParams }: { searchParams?: Promise<{ token?: string }> }) {
  const header = (await headers()).get("x-render-token");
  const query = searchParams ? (await searchParams)?.token : undefined;
  if (!renderAuthorized(header || query || null)) notFound();
  return <RenderStage />;
}
