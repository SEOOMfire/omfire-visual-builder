import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { renderAuthorized } from "../../../src/modules/visual-builder/server/render-token";
import { RenderStage } from "./stage";

export const dynamic = "force-dynamic";

export default async function RenderPage() {
  const header = (await headers()).get("x-render-token");
  if (!renderAuthorized(header)) notFound();
  return <RenderStage />;
}
