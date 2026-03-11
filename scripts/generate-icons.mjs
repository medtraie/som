import fs from "fs";
import path from "path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const publicDir = path.resolve(process.cwd(), "public");
let src = path.join(publicDir, "source-icon.png");
const altSrc = path.resolve(process.cwd(), "image.png");

async function main() {
  if (!fs.existsSync(publicDir)) {
    console.error("Public directory not found");
    process.exit(1);
  }
  if (!fs.existsSync(src)) {
    if (fs.existsSync(altSrc)) {
      src = altSrc;
      console.log("Using fallback source image: image.png at project root");
    } else {
      console.log("source-icon.png not found in /public and no fallback image.png, skipping generation");
      process.exit(0);
    }
  }

  const out = (name) => path.join(publicDir, name);

  await sharp(src).resize(16, 16).png().toFile(out("favicon-16x16.png"));
  await sharp(src).resize(32, 32).png().toFile(out("favicon-32x32.png"));
  await sharp(src).resize(180, 180).png().toFile(out("apple-touch-icon.png"));
  await sharp(src).resize(192, 192).png().toFile(out("android-chrome-192x192.png"));
  await sharp(src).resize(512, 512).png().toFile(out("android-chrome-512x512.png"));
  await sharp(src).resize(512, 512).png().toFile(out("maskable-512x512.png"));

  const icoBuf = await pngToIco([
    await sharp(src).resize(16, 16).png().toBuffer(),
    await sharp(src).resize(32, 32).png().toBuffer(),
    await sharp(src).resize(48, 48).png().toBuffer(),
    await sharp(src).resize(64, 64).png().toBuffer(),
  ]);
  fs.writeFileSync(out("favicon.ico"), icoBuf);

  console.log("Icons generated into /public");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
