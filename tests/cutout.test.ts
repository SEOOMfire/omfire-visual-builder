import assert from "node:assert/strict";
import test from "node:test";
import { PNG } from "pngjs";
import { OTELO_FORMATS } from "../src/modules/visual-builder/otelo-formats";
import { arrowSpan, buildScene, deviceInside, fitHeadlineForChevrons, fitSublineText, renderedStarDiameter, renderedStarTextSize, wavePaintShare, type SceneCopy } from "../src/modules/visual-builder/otelo-scene";
import { blockingHints } from "../src/modules/visual-builder/server/creative-archive";
import { headInside, measureCutout, placeCutout, type Cutout } from "../src/modules/visual-builder/server/cutout";
import { glanceContradictsMeasure } from "../src/modules/visual-builder/server/review";

function portraitWithFace(): Buffer {
  const png = new PNG({ width: 80, height: 140 });
  png.data.fill(0);
  for (let y = 10; y < 130; y += 1) {
    for (let x = 15; x < 65; x += 1) {
      const index = (y * 80 + x) * 4;
      png.data[index] = 230;
      png.data[index + 1] = 120;
      png.data[index + 2] = 40;
      png.data[index + 3] = 255;
    }
  }
  for (let y = 18; y < 42; y += 1) {
    for (let x = 28; x < 52; x += 1) {
      const index = (y * 80 + x) * 4;
      png.data[index] = 210;
      png.data[index + 1] = 160;
      png.data[index + 2] = 130;
      png.data[index + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

const copy = (): SceneCopy => ({
  headline: "BLACK WEEK",
  subline: "3-FACH DATEN. GLEICHER PREIS.",
  button: "Jetzt sichern",
  stoererTyp: "stern",
  preis: "19,99 €",
  preisZusatz: "pro Monat",
  einmalpreis: "",
  aktionText: "",
  pflichttext: "",
  headlineVariante: "direkt",
  orange: "rechts",
  produktname: "",
  datenmenge: "150 GB",
  datenmengeAlt: "50 GB",
  sternText: "YOUNG DEAL",
  deko: "bw_wellen",
  kampagne: "BW",
});

test("transparent margins are ignored and the head stays in the frame", () => {
  const cutout = measureCutout(portraitWithFace());
  assert.ok(cutout);
  assert.ok(cutout.opaque.y > 0, "the clear margin is trimmed");
  assert.ok(cutout.head.y >= cutout.opaque.y);
  assert.ok(cutout.head.h < cutout.opaque.h * 0.6);
  for (const format of OTELO_FORMATS) {
    const scene = buildScene(format, "kachel_person", copy(), {}, cutout);
    assert.ok(scene.headBox, format.id);
    assert.equal(scene.hints.some((hint) => hint.startsWith("Der Kopf ist nicht")), false, `${format.id} ${scene.hints.join(" | ")}`);
    assert.equal(scene.hints.some((hint) => /Figur überlappt Headline|Figur überlappt Subline|Figur überlappt Kachel/.test(hint)), false, scene.hints.join(" | "));
    const top = (scene.figure?.y ?? 0) / format.h;
    const wide = format.w / format.h > 1.5;
    const tall = format.id.endsWith("9x16");
    const band = wide ? [0.1, 0.2] : tall ? [0.35, 0.5] : [0.3, 0.4];
    assert.ok(top >= band[0] - 0.02 && top <= band[1] + 0.02, `${format.id} ${top.toFixed(2)}`);
    const bottom = ((scene.figure?.y ?? 0) + (scene.figure?.h ?? 0)) / format.h;
    if (tall) assert.ok(Math.abs(bottom - 1) <= 0.005, `${format.id} bottom ${bottom.toFixed(3)}`);
    else assert.ok(bottom > 1, format.id);
    assert.ok(headInside(scene.headBox, format.w, format.h), format.id);
    assert.equal(scene.hints.some((hint) => hint.includes("zu kurz")), false, scene.hints.join(" | "));
    assert.equal(scene.hints.some((hint) => hint.includes("Stern überdeckt")), false, scene.hints.join(" | "));
    assert.equal(scene.hints.some((hint) => hint.includes("Wellen überlagern")), false, scene.hints.join(" | "));
    if (scene.stern && scene.kachel) {
      const hitsLine = (box: { x: number; y: number; w: number; h: number }) => scene.stern!.box.x < box.x + box.w && box.x < scene.stern!.box.x + scene.stern!.box.w && scene.stern!.box.y < box.y + box.h && box.y < scene.stern!.box.y + scene.stern!.box.h;
      assert.equal(hitsLine(scene.headline.box), false, `${format.id} Headline`);
      assert.equal(hitsLine(scene.subline.box), false, `${format.id} Unterzeile`);
    }
    if (wide) {
      assert.ok(Math.abs(scene.headline.box.w / format.w - 0.55) < 0.02, format.id);
      assert.ok(scene.kachel && Math.abs(scene.kachel.box.w / format.w - 0.22) < 0.02, format.id);
      const gap = scene.subline.box.y - (scene.headline.box.y + scene.headline.box.h);
      assert.ok(gap >= scene.headline.box.h * 0.1, format.id);
    }
    assert.equal(scene.hints.some((hint) => /überlappt/.test(hint)), false, scene.hints.join(" | "));
    if (scene.stern && scene.kachel) {
      assert.ok(scene.stern.box.w * 0.96 >= scene.kachel.box.w * 0.2, format.id);
      if (format.id === "pmax-960x1200") {
        const center = scene.stern.box.y + scene.stern.box.h / 2;
        assert.ok(center < scene.kachel.box.y + scene.kachel.box.h * 0.4, `960 Stern sitzt bei ${center.toFixed(0)}`);
      }
    }
  }
});

test("the device star uses the visible phone and the pill follows its text", () => {
  const phone: Cutout = { imageW: 3000, imageH: 2000, opaque: { x: 1140, y: 96, w: 750, h: 1800 }, head: { x: 0, y: 0, w: 1, h: 1 } };
  const fields = { ...copy(), einmalpreis: "1 €", preisAlt: "229 €", datenmenge: "50 GB", datenmengeAlt: "", sternText: "", geraetName: "Samsung Galaxy A57" };
  for (const format of OTELO_FORMATS) {
    const scene = buildScene(format, "kachel_geraet", fields, {}, undefined, undefined, phone);
    const pill = scene.pill?.box;
    const tile = scene.kachel?.box;
    const star = scene.stern?.box;
    assert.ok(pill && tile && star, format.id);
    const shared = Math.max(0, Math.min(pill.x + pill.w, tile.x + tile.w) - Math.max(pill.x, tile.x));
    assert.ok(shared <= pill.w * 0.1 + 2, `${format.id} Pille ${shared.toFixed(0)}`);
    assert.ok(pill.w > pill.h * 1.6, format.id);
    assert.ok(star.w >= tile.w * 0.2, `${format.id} ${star.w.toFixed(0)} / ${tile.w.toFixed(0)}`);
    const cx = star.x + star.w / 2;
    const cy = star.y + star.h / 2;
    assert.equal(cx > pill.x && cx < pill.x + pill.w && cy > pill.y && cy < pill.y + pill.h, false, format.id);
    const meetsPill = star.x < pill.x + pill.w && pill.x < star.x + star.w && star.y < pill.y + pill.h && pill.y < star.y + star.h;
    const meetsTile = star.x < tile.x + tile.w && tile.x < star.x + star.w && star.y < tile.y + tile.h && tile.y < star.y + star.h;
    const dx = star.x > pill.x + pill.w ? star.x - (pill.x + pill.w) : pill.x > star.x + star.w ? pill.x - (star.x + star.w) : 0;
    const dy = star.y > pill.y + pill.h ? star.y - (pill.y + pill.h) : pill.y > star.y + star.h ? pill.y - (star.y + star.h) : 0;
    const pillGap = dx === 0 && dy === 0 ? 0 : dx > 0 && dy > 0 ? Math.hypot(dx, dy) : dx + dy;
    assert.equal(meetsPill || meetsTile || (pillGap > 0 && pillGap <= format.w * 0.02 + 2), true, format.id);
    assert.equal(scene.hints.some((hint) => hint.includes("nicht bestanden") || hint.includes("überdeckt das Gerät") || hint.includes("Pillentext")), false, `${format.id} ${scene.hints.join(" | ")}`);
  }
});

test("a device tile keeps the price, the pill and the phone apart", () => {
  const deviceCopy = copy();
  deviceCopy.einmalpreis = "229 €";
  deviceCopy.einmalpreisZusatz = "+ mtl. 10 €";
  deviceCopy.datenmenge = "150 GB";
  deviceCopy.datenmengeAlt = "50 GB";
  deviceCopy.geraetName = "Samsung Galaxy A57";
  for (const format of OTELO_FORMATS) {
    const scene = buildScene(format, "kachel_geraet", deviceCopy);
    assert.ok(scene.pill && scene.pill.box.w > scene.pill.box.h, format.id);
    assert.ok(scene.cta.box.h > 2 && scene.cta.text.length > 0, format.id);
    assert.equal(scene.hints.some((hint) => /CTA fehlt|überlappt|Gerät ist zu klein|Stern überdeckt das Logo/.test(hint)), false, `${format.id} ${scene.hints.join(" | ")}`);
    assert.ok(scene.product && scene.product.h >= format.h * (format.id.endsWith("9x16") ? 0.42 : 0.55), format.id);
    if (scene.logo.box.w > 2) {
      const logo = scene.logo.box;
      const cta = scene.cta.box;
      const hits = logo.x < cta.x + cta.w && cta.x < logo.x + logo.w && logo.y < cta.y + cta.h && cta.y < logo.y + logo.h;
      assert.equal(hits, false, `${format.id} Logo überlappt CTA`);
    }
    if (format.id.endsWith("9x16") && scene.product) {
      const person = buildScene(format, "kachel_person", copy());
      assert.ok(Math.abs(scene.cta.box.h - person.cta.box.h) < 2, format.id);
      assert.ok(Math.abs(scene.cta.box.w - person.cta.box.w) < 2, format.id);
      const product = scene.product;
      const cta = scene.cta.box;
      const hits = product.x < cta.x + cta.w && cta.x < product.x + product.w && product.y < cta.y + cta.h && cta.y < product.y + product.h;
      assert.equal(hits, false, `${format.id} Gerät überlappt CTA`);
      assert.ok(product.y <= cta.y + cta.h + format.h * 0.02, `${format.id} Gerät sitzt nicht unter der CTA`);
      if (scene.stern) {
        const overlapW = Math.max(0, Math.min(scene.stern.box.x + scene.stern.box.w, product.x + product.w) - Math.max(scene.stern.box.x, product.x));
        const overlapH = Math.max(0, Math.min(scene.stern.box.y + scene.stern.box.h, product.y + product.h) - Math.max(scene.stern.box.y, product.y));
        const share = (overlapW * overlapH) / Math.max(1, scene.stern.box.w * scene.stern.box.h);
        assert.ok(share <= 0.05, `${format.id} Stern über dem Gerät ${share.toFixed(2)}`);
      }
      assert.equal(scene.hints.some((hint) => hint.includes("Pillentext") || hint.includes("außerhalb der sicheren Zone") || hint.includes("überdeckt das Gerät")), false, scene.hints.join(" | "));
    }
  }
});

test("six person motifs stay clear of a failing check on both text sets", () => {
  const motif = (head: Cutout["head"], body: Cutout["opaque"]): Cutout => ({ imageW: 400, imageH: 800, opaque: body, head });
  const motifs = [
    motif({ x: 180, y: 40, w: 120, h: 140 }, { x: 80, y: 20, w: 260, h: 760 }),
    motif({ x: 40, y: 30, w: 150, h: 160 }, { x: 20, y: 10, w: 340, h: 740 }),
    motif({ x: 200, y: 80, w: 110, h: 130 }, { x: 60, y: 40, w: 280, h: 700 }),
    motif({ x: 140, y: 20, w: 100, h: 120 }, { x: 40, y: 10, w: 300, h: 780 }),
    motif({ x: 90, y: 50, w: 140, h: 150 }, { x: 30, y: 20, w: 320, h: 720 }),
    motif({ x: 220, y: 60, w: 90, h: 110 }, { x: 100, y: 30, w: 240, h: 750 }),
  ];
  const summer = { ...copy(), headline: "SOMMER-DEAL", subline: "JETZT ZUSCHLAGEN", sternText: "1. MONAT GRATIS", deko: "fruehling_blaetter" as const };
  const endless = { ...copy(), headline: "ENDLOS SURFEN", subline: "UNBEGRENZTES DATENVOLUMEN IM VODAFONE-NETZ", sternText: "", deko: "keine" as const };
  for (const [index, cutout] of motifs.entries()) {
    for (const fields of [summer, endless]) {
      for (const format of OTELO_FORMATS) {
        const scene = buildScene(format, "kachel_person", fields, {}, cutout);
        const blocking = blockingHints(scene.hints).filter((hint) => !/Gesicht/.test(hint));
        assert.deepEqual(blocking, [], `${index} ${fields.headline} ${format.id} ${scene.hints.join(" | ")}`);
        if (scene.stern && scene.headBox) {
          const star = scene.stern.box;
          const face = scene.headBox;
          const hits = star.x < face.x + face.w && face.x < star.x + star.w && star.y < face.y + face.h && face.y < star.y + star.h;
          assert.equal(hits, false, `${index} ${format.id} Stern auf dem Gesicht`);
        }
        if (scene.headBox && scene.kachel && scene.kachel.box.w > 2 && !scene.hints.some((hint) => hint.includes("Gesicht"))) {
          const face = scene.headBox;
          const tile = scene.kachel.box;
          const dx = face.x > tile.x + tile.w ? face.x - (tile.x + tile.w) : tile.x > face.x + face.w ? tile.x - (face.x + face.w) : 0;
          const dy = face.y > tile.y + tile.h ? face.y - (tile.y + tile.h) : tile.y > face.y + face.h ? tile.y - (face.y + face.h) : 0;
          const gap = dx === 0 && dy === 0 ? 0 : dx > 0 && dy > 0 ? Math.hypot(dx, dy) : dx + dy;
          assert.ok(gap + 1 >= format.w * 0.05, `${index} ${format.id} Abstand ${gap.toFixed(0)}`);
        }
      }
    }
  }
});

test("orange clothing only hints that the deco disappears", () => {
  const cutout: Cutout = {
    imageW: 400,
    imageH: 800,
    opaque: { x: 80, y: 20, w: 240, h: 760 },
    head: { x: 140, y: 30, w: 120, h: 140 },
    orangeCloth: true,
  };
  const scene = buildScene(OTELO_FORMATS[0], "kachel_person", { ...copy(), deko: "fruehling_blaetter" }, {}, cutout);
  assert.ok(scene.hints.some((hint) => hint.startsWith("Hinweis:") && hint.includes("Deko kaum sichtbar")));
  assert.equal(scene.hints.some((hint) => hint.includes("Deko kaum sichtbar") && !hint.startsWith("Hinweis:")), false);
});

test("the A57 name and energy label stay off the visible phone on 9x16", () => {
  const phone: Cutout = { imageW: 2400, imageH: 1600, opaque: { x: 904, y: 80, w: 595, h: 1440 }, head: { x: 0, y: 0, w: 1, h: 1 } };
  const fields = { ...copy(), einmalpreis: "1 €", preisAlt: "229 €", datenmenge: "50 GB", datenmengeAlt: "", sternText: "", geraetName: "Samsung Galaxy A57 5G" };
  for (const format of OTELO_FORMATS.filter((item) => item.id.endsWith("9x16"))) {
    const scene = buildScene(format, "kachel_geraet", fields, {}, undefined, undefined, phone);
    const name = scene.deviceLabel?.box;
    const badge = scene.energy;
    const seen = scene.productPaint?.opaque;
    assert.ok(name && badge && seen, format.id);
    assert.ok(name.w + 1 >= fields.geraetName.length * name.h * 0.55, `${format.id} name ${name.w.toFixed(0)}`);
    assert.ok(badge.x >= name.x + name.w + format.w * 0.01, `${format.id} label ${badge.x.toFixed(0)}`);
    assert.ok(seen.x >= badge.x + badge.w + format.w * 0.01, `${format.id} phone ${seen.x.toFixed(0)} badge ${(badge.x + badge.w).toFixed(0)}`);
    const hits = (box: { x: number; y: number; w: number; h: number }) => box.x < seen.x + seen.w && seen.x < box.x + box.w && box.y < seen.y + seen.h && seen.y < box.y + box.h;
    assert.equal(hits(name), false, format.id);
    assert.equal(hits(badge), false, format.id);
    assert.equal(scene.hints.some((hint) => hint.includes("Gerätename überlappt")), false, scene.hints.join(" | "));
  }
});

test("the rendered device star is at least 45 percent of the lime tile", () => {
  const phone: Cutout = { imageW: 2400, imageH: 1600, opaque: { x: 904, y: 80, w: 595, h: 1440 }, head: { x: 0, y: 0, w: 1, h: 1 } };
  const fields = { ...copy(), einmalpreis: "1 €", preisAlt: "229 €", datenmenge: "50 GB", datenmengeAlt: "", sternText: "", geraetName: "Samsung Galaxy A57 5G" };
  for (const format of OTELO_FORMATS) {
    const scene = buildScene(format, "kachel_geraet", fields, {}, undefined, undefined, phone);
    const star = scene.stern?.box;
    const tile = scene.kachel?.box;
    assert.ok(star && tile, format.id);
    const ratio = renderedStarDiameter(star.w) / tile.w;
    assert.ok(ratio >= 0.45, `${format.id} ${ratio.toFixed(2)}`);
    assert.ok(renderedStarTextSize(star.w, "50 GB") >= format.h * 0.02 - 0.2, `${format.id} text ${renderedStarTextSize(star.w, "50 GB").toFixed(1)}`);
  }
});

test("the three live briefings stay free of blocking hints", () => {
  const named = (hint: string) => !hint.includes("1080x1920") || /1080x1920 (Meta|Tiktok)/.test(hint);
  const endless = { ...copy(), headline: "ENDLOS SURFEN", subline: "UNBEGRENZTES DATENVOLUMEN IM VODAFONE-NETZ", deko: "keine" as const };
  const sommer = { ...copy(), headline: "SOMMER-DEAL", sternText: "1. MONAT GRATIS", deko: "fruehling_blaetter" as const };
  const phone: Cutout = { imageW: 2400, imageH: 1600, opaque: { x: 904, y: 80, w: 595, h: 1440 }, head: { x: 0, y: 0, w: 1, h: 1 } };
  const a57 = { ...copy(), einmalpreis: "1 €", preisAlt: "229 €", datenmenge: "50 GB", datenmengeAlt: "", sternText: "", geraetName: "Samsung Galaxy A57 5G" };
  const pulli: Cutout = { imageW: 800, imageH: 1400, opaque: { x: 160, y: 20, w: 480, h: 1320 }, head: { x: 340, y: 60, w: 240, h: 260 }, orangeCloth: true };
  for (const format of OTELO_FORMATS) {
    for (const [name, scene] of [
      ["endlos", buildScene(format, "kachel_person", endless)],
      ["sommer", buildScene(format, "kachel_person", sommer, {}, pulli)],
      ["a57", buildScene(format, "kachel_geraet", a57, {}, undefined, undefined, phone)],
    ] as const) {
      assert.equal(blockingHints(scene.hints).length, 0, `${name} ${format.id} ${scene.hints.join(" | ")}`);
      assert.ok(scene.hints.every(named), scene.hints.join(" | "));
    }
    const device = buildScene(format, "kachel_geraet", a57, {}, undefined, undefined, phone);
    const seen = device.productPaint?.opaque;
    assert.ok(seen, format.id);
    const view = deviceInside(seen, format.w, format.h);
    assert.equal(view.rightCrop, false, format.id);
    assert.ok(view.share >= 0.85, `${format.id} ${view.share.toFixed(2)}`);
    if (format.id.endsWith("9x16") && device.cta.box.w > 2) {
      assert.ok(seen.y >= device.cta.box.y + device.cta.box.h + format.h * 0.02 - 1, `${format.id} CTA ${seen.y.toFixed(0)}`);
    }
    if (format.id === "pmax-1200x1200" || format.id === "meta-1x1") {
      const star = device.stern?.box;
      const pill = device.pill?.box;
      assert.ok(star && pill, format.id);
      const dx = star.x > pill.x + pill.w ? star.x - (pill.x + pill.w) : pill.x > star.x + star.w ? pill.x - (star.x + star.w) : 0;
      const dy = star.y > pill.y + pill.h ? star.y - (pill.y + pill.h) : pill.y > star.y + star.h ? pill.y - (star.y + star.h) : 0;
      const gap = dx === 0 && dy === 0 ? 0 : dx > 0 && dy > 0 ? Math.hypot(dx, dy) : dx + dy;
      assert.ok(gap >= format.w * 0.01, `${format.id} Abstand ${gap.toFixed(0)}`);
    }
    const person = buildScene(format, "kachel_person", sommer, {}, pulli);
    if (format.id.endsWith("9x16") && person.stern && person.kachel) {
      const star = person.stern.box;
      const tile = person.kachel.box;
      const relY = (star.y + star.h / 2 - tile.y) / tile.h;
      assert.ok(relY < 0.55, `${format.id} relY ${relY.toFixed(2)}`);
    }
  }
});

test("the Sommer star stays on the top of the tile", () => {
  const cutout: Cutout = {
    imageW: 800,
    imageH: 1400,
    opaque: { x: 160, y: 20, w: 480, h: 1320 },
    head: { x: 340, y: 60, w: 240, h: 260 },
    orangeCloth: true,
  };
  const fields = { ...copy(), headline: "SOMMER-DEAL", sternText: "1. MONAT GRATIS", deko: "fruehling_blaetter" as const };
  for (const format of OTELO_FORMATS.filter((item) => item.id.endsWith("9x16"))) {
    const scene = buildScene(format, "kachel_person", fields, {}, cutout);
    const star = scene.stern?.box;
    const tile = scene.kachel?.box;
    assert.ok(star && tile, format.id);
    const relY = (star.y + star.h / 2 - tile.y) / tile.h;
    assert.ok(relY < 0.55, `${format.id} relY ${relY.toFixed(2)}`);
    const meetsTile = star.x < tile.x + tile.w && tile.x < star.x + star.w && star.y < tile.y + tile.h && tile.y < star.y + star.h;
    assert.equal(meetsTile, true, format.id);
    assert.equal(scene.hints.some((hint) => hint.includes("orangem Motiv") && !hint.startsWith("Hinweis:")), false);
  }
});

test("a 9x16 star grows until the offer text reaches the minimum", () => {
  const cutout: Cutout = {
    imageW: 800,
    imageH: 1400,
    opaque: { x: 180, y: 40, w: 440, h: 1280 },
    head: { x: 360, y: 80, w: 220, h: 280 },
  };
  const fields = { ...copy(), sternText: "1. MONAT GRATIS", deko: "fruehling_blaetter" as const };
  for (const format of OTELO_FORMATS.filter((item) => item.id.endsWith("9x16"))) {
    const scene = buildScene(format, "kachel_person", fields, {}, cutout);
    const star = scene.stern?.box;
    assert.ok(star, format.id);
    assert.ok(renderedStarTextSize(star.w, "1. MONAT GRATIS") >= format.h * 0.02 - 0.2, `${format.id} ${renderedStarTextSize(star.w, "1. MONAT GRATIS").toFixed(1)}`);
    assert.equal(scene.hints.some((hint) => hint.includes("Stern-Text ist zu klein")), false, scene.hints.join(" | "));
    if (scene.headBox && scene.headBox.w > 2) {
      const face = scene.headBox;
      const hits = star.x < face.x + face.w && face.x < star.x + star.w && star.y < face.y + face.h && face.y < star.y + star.h;
      assert.equal(hits, false, `${format.id} Stern auf dem Gesicht`);
    }
  }
});

test("the device star on the wide formats sits on the upper tile corner", () => {
  const fields = { ...copy(), einmalpreis: "1 €", preisAlt: "229 €", datenmenge: "50 GB", datenmengeAlt: "", sternText: "", geraetName: "Samsung Galaxy A57", subline: "3-FACH DATEN. GLEICHER PREIS." };
  for (const format of OTELO_FORMATS.filter((item) => !item.id.endsWith("9x16"))) {
    const scene = buildScene(format, "kachel_geraet", fields);
    const star = scene.stern?.box;
    const tile = scene.kachel?.box;
    assert.ok(star && tile, format.id);
    assert.ok(renderedStarDiameter(star.w) >= tile.w * 0.2 - 1, `${format.id} rendered ${renderedStarDiameter(star.w).toFixed(0)} / tile ${tile.w.toFixed(0)}`);
    assert.ok(renderedStarTextSize(star.w, "50 GB") >= format.h * 0.02 - 0.2, `${format.id} text ${renderedStarTextSize(star.w, "50 GB").toFixed(1)}`);
    const relY = (star.y + star.h / 2 - tile.y) / tile.h;
    assert.ok(relY < 0.55, `${format.id} relY ${relY.toFixed(2)}`);
    assert.equal(scene.hints.some((hint) => hint.includes("Pillentext") || hint.includes("überdeckt CTA") || hint.includes("überdeckt statt")), false, scene.hints.join(" | "));
  }
  const wide = OTELO_FORMATS.find((format) => format.id === "pmax-1200x628");
  assert.ok(wide);
  const person = buildScene(wide, "kachel_person", copy());
  const device = buildScene(wide, "kachel_geraet", fields);
  assert.ok(Math.abs(device.headline.box.w - person.headline.box.w) < 2, `${device.headline.box.w} / ${person.headline.box.w}`);
  assert.ok(Math.abs(device.headline.box.h - person.headline.box.h) < 2);
  assert.ok(Math.abs(device.subline.box.h - person.subline.box.h) < 2);
  assert.ok(Math.abs(device.cta.box.h - person.cta.box.h) < 2);
  const rendered = (scene: ReturnType<typeof buildScene>, canvasW: number) => {
    const text = scene.headline.lines[0] ?? "";
    const box = scene.headline.box;
    const natural = Math.min(box.h, box.w / Math.max(1, text.length * 0.572));
    return fitHeadlineForChevrons(text.length * 0.572 * natural, natural, canvasW * 0.96, box.x).fontSize;
  };
  const personHead = rendered(person, wide.w);
  const deviceHead = rendered(device, wide.w);
  assert.ok(Math.abs(deviceHead - personHead) < 2, `${deviceHead.toFixed(1)} / ${personHead.toFixed(1)}`);
  const subSize = (scene: ReturnType<typeof buildScene>, head: number) => fitSublineText(scene.subline.lines.map((line) => line.text).join(" "), head, scene.subline.box.w, (sample, size) => sample.length * size * 0.5).size;
  assert.ok(subSize(device, deviceHead) >= subSize(person, personHead) - 1);
  assert.ok((device.deviceLabel?.box.h ?? 0) >= wide.h * 0.05 - 1, `name ${device.deviceLabel?.box.h}`);
  assert.ok((device.energy?.h ?? 0) >= (device.deviceLabel?.box.h ?? 0) * 1.4);
  const story = OTELO_FORMATS.find((format) => format.id === "meta-9x16");
  assert.ok(story);
  const named = buildScene(story, "kachel_geraet", fields);
  assert.ok((named.deviceLabel?.box.h ?? 0) >= story.h * 0.03 - 1);
  assert.ok((named.energy?.h ?? 0) >= story.h * 0.03 - 1);
});

test("chevrons stay when the deco is leaves", () => {
  const scene = buildScene(OTELO_FORMATS[3], "kachel_person", { ...copy(), deko: "fruehling_blaetter" });
  assert.equal(scene.headlinePfeile, true);
});

test("the wave bundle covers at least 12 percent of the square", () => {
  assert.ok(wavePaintShare(1080, 1080) >= 0.12);
  assert.ok(wavePaintShare(1080, 1920) >= 0.06, "waves stay visible on 9x16");
});

test("arrows stop before the head", () => {
  const span = arrowSpan(400, 80, 470);
  assert.ok(span.end <= 470);
  assert.ok(span.count < 3);
});

test("a short motif fails the 9x16 length rule", () => {
  const cutout: Cutout = {
    imageW: 800,
    imageH: 300,
    opaque: { x: 0, y: 0, w: 800, h: 220 },
    head: { x: 80, y: 0, w: 640, h: 90 },
  };
  const story = OTELO_FORMATS.find((format) => format.id === "meta-9x16");
  assert.ok(story);
  const scene = buildScene(story, "kachel_person", copy(), {}, cutout);
  assert.ok(scene.hints.some((hint) => hint.includes("nicht bestanden: Motiv für 9x16 zu kurz")), scene.hints.join(" | "));
});

test("Cobra and A57 keep the star off every text box", () => {
  const hits = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.w > 2 && b.w > 2 && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const cobra = { ...copy(), sternText: "NUR BIS SONNTAG" };
  const a57 = { ...copy(), einmalpreis: "1 €", preisAlt: "229 €", datenmenge: "50 GB", datenmengeAlt: "", sternText: "", geraetName: "Samsung Galaxy A57" };
  for (const [name, fields] of [["kachel_person", cobra], ["kachel_geraet", a57]] as const) {
    for (const format of OTELO_FORMATS) {
      const scene = buildScene(format, name, fields);
      assert.ok(scene.stern && scene.stern.box.w > 2, format.id);
      const boxes = [scene.headline.box, scene.subline.box, scene.cta.box];
      const covered = boxes.some((box) => hits(scene.stern!.box, box));
      const failed = scene.hints.some((hint) => hint.startsWith("nicht bestanden") && hint.includes("Stern"));
      assert.equal(covered, failed, `${name} ${format.id} ${scene.hints.join(" | ")}`);
      assert.equal(covered, false, `${name} ${format.id} Stern auf Text`);
      assert.equal(glanceContradictsMeasure(scene.hints, "Der Text überlappt die Unterzeile."), covered === false);
      assert.equal(glanceContradictsMeasure(scene.hints, "Aufbau und Größen passen."), false);
    }
  }
});

test("placing a cutout keeps the hairline in the measured band", () => {
  const cutout: Cutout = {
    imageW: 1000,
    imageH: 1600,
    opaque: { x: 80, y: 40, w: 840, h: 1500 },
    head: { x: 300, y: 40, w: 360, h: 280 },
  };
  const placed = placeCutout({ canvasW: 1080, canvasH: 1080, cutout, left: 560, topFraction: 0.35 });
  assert.ok(Math.abs(placed.figure.y / 1080 - 0.35) < 0.01);
  assert.ok(placed.figure.y + placed.figure.h > 1080);
  assert.ok(placed.figure.x >= 560);
  assert.ok(headInside(placed.head, 1080, 1080));
});
