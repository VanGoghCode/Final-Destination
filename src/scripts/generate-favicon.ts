import sharp from "sharp";
import path from "path";

async function generateRoundedFavicon() {
  const publicDir = path.join(process.cwd(), "public");
  const logoPath = path.join(publicDir, "logo.png");

  // Read the logo
  const logo = sharp(logoPath);
  await logo.metadata(); // Validate image exists

  const size = 64; // Standard favicon size

  // Create a circular mask
  const roundedCorners = Buffer.from(
    `<svg><rect x="0" y="0" width="${size}" height="${size}" rx="${size / 2}" ry="${size / 2}"/></svg>`
  );

  // Resize and apply rounded mask
  const roundedImage = await sharp(logoPath)
    .resize(size, size, { fit: "cover" })
    .composite([
      {
        input: roundedCorners,
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();

  // Save as PNG first (for better quality favicon)
  const faviconPngPath = path.join(publicDir, "favicon.png");
  await sharp(roundedImage).toFile(faviconPngPath);

  // Also create multiple sizes for better browser support
  await sharp(logoPath)
    .resize(32, 32, { fit: "cover" })
    .composite([
      {
        input: Buffer.from(
          `<svg><rect x="0" y="0" width="32" height="32" rx="16" ry="16"/></svg>`
        ),
        blend: "dest-in",
      },
    ])
    .png()
    .toFile(path.join(publicDir, "icon-32.png"));

  await sharp(logoPath)
    .resize(192, 192, { fit: "cover" })
    .composite([
      {
        input: Buffer.from(
          `<svg><rect x="0" y="0" width="192" height="192" rx="96" ry="96"/></svg>`
        ),
        blend: "dest-in",
      },
    ])
    .png()
    .toFile(path.join(publicDir, "icon-192.png"));

  await sharp(logoPath)
    .resize(512, 512, { fit: "cover" })
    .composite([
      {
        input: Buffer.from(
          `<svg><rect x="0" y="0" width="512" height="512" rx="256" ry="256"/></svg>`
        ),
        blend: "dest-in",
      },
    ])
    .png()
    .toFile(path.join(publicDir, "icon-512.png"));

  // Create apple touch icon (rounded)
  await sharp(logoPath)
    .resize(180, 180, { fit: "cover" })
    .composite([
      {
        input: Buffer.from(
          `<svg><rect x="0" y="0" width="180" height="180" rx="40" ry="40"/></svg>`
        ),
        blend: "dest-in",
      },
    ])
    .png()
    .toFile(path.join(publicDir, "apple-touch-icon.png"));

  console.log("✓ Generated rounded favicon and icons!");
}

generateRoundedFavicon().catch(console.error);
