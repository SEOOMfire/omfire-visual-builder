import JSZip from "jszip";
import { OTELO_FORMATS } from "../otelo-formats";
import { archivePeriod } from "./creative-archive";
import { inspectBatch } from "./csv-batch";
import { oteloFileName, oteloFolder } from "./naming";
import { renderTemplate } from "./otelo-render";
import { storePreview } from "./previews";
import { previewUrl } from "./public-url";

export async function runCreativeBatch(source: string): Promise<{ summary: string; url: string; contacts: string[] }> {
  const inspected = inspectBatch(source);
  if (inspected.errors.length) throw new Error(inspected.errors.join(" "));
  if (!inspected.rows.length) throw new Error("Die CSV hat keine Zeilen.");
  const zip = new JSZip();
  const period = archivePeriod();
  const contacts: string[] = [];
  let count = 0;
  for (const row of inspected.rows) {
    const rendered = await renderTemplate({
      name: row.template,
      motiv: row.motif,
      headline: row.headline,
      subline: row.subline,
      button: row.button,
      preis: row.price,
      preisZusatz: row.priceExtra || "pro Monat",
      einmalpreis: row.once,
      einmalpreisZusatz: row.onceExtra,
      preisAlt: row.oldPrice,
      datenmenge: row.data,
      datenmengeAlt: row.dataOld,
      sternText: row.star,
      deko: row.deco || undefined,
      geraetName: row.deviceName,
      energielabel: row.energy,
      kampagne: row.campaign,
    });
    contacts.push(previewUrl(rendered.token));
    for (const format of OTELO_FORMATS) {
      if (!row.formats.includes(format.id)) continue;
      const png = rendered.formats.find((item) => item.id === format.id);
      if (!png) continue;
      const named = {
        channel: format.channel,
        quarter: period.quarter,
        monthYear: period.monthYear,
        campaign: row.campaign,
        motif: row.nameExtra ? `${row.motif}-${row.nameExtra}` : row.motif,
        format: format.token,
        audience: row.audience || "Hardware-Standard",
      };
      zip.file(`${oteloFolder(named)}/${oteloFileName(named)}`, Buffer.from(png.pngBase64, "base64"));
      count += 1;
    }
  }
  const zipName = `${period.quarter}_${period.monthYear}_${inspected.rows[0]?.campaign || "stapel"}.zip`;
  const bytes = await zip.generateAsync({ type: "nodebuffer" });
  const token = await storePreview(zipName, bytes);
  return {
    url: previewUrl(token),
    contacts,
    summary: `${inspected.rows.length} Motive, ${count} Dateien.`,
  };
}
