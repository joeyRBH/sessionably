const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateFavicons() {
  const svgPath = path.join(__dirname, 'logo.svg');
  const svgBuffer = fs.readFileSync(svgPath);

  const sizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'android-chrome-192x192.png', size: 192 },
    { name: 'android-chrome-512x512.png', size: 512 }
  ];

  console.log('Generating favicon files...');

  for (const { name, size } of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(__dirname, name));
    console.log(`✓ Created ${name}`);
  }

  // Create favicon.ico from 32x32 PNG
  // Note: .ico format support in sharp requires using toFormat
  await sharp(svgBuffer)
    .resize(32, 32)
    .toFormat('png')
    .toFile(path.join(__dirname, 'favicon.ico'));
  console.log('✓ Created favicon.ico');

  console.log('\nAll favicon files generated successfully!');
}

generateFavicons().catch(console.error);
