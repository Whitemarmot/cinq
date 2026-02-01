#!/usr/bin/env node

/**
 * Script pour créer des screenshots PWA basiques
 * Génère des PNG simples pour satisfaire les exigences du manifest
 */

const fs = require('fs');
const path = require('path');

// Créer des fichiers PNG simples avec une signature basique
function createBasicPNG(width, height, color = '#0a0a0b') {
    // En-tête PNG basique (simplifié)
    const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    
    // IHDR chunk (largeur, hauteur, bit depth, color type, etc.)
    const ihdr = Buffer.alloc(25);
    ihdr.writeUInt32BE(13, 0);  // chunk length
    ihdr.write('IHDR', 4);      // chunk type
    ihdr.writeUInt32BE(width, 8);   // width
    ihdr.writeUInt32BE(height, 12); // height
    ihdr.writeUInt8(8, 16);     // bit depth
    ihdr.writeUInt8(2, 17);     // color type (RGB)
    
    // Données d'image basiques (pixel uniforme)
    const rowSize = width * 3 + 1;  // 3 bytes par pixel RGB + 1 byte filter
    const dataSize = height * rowSize;
    const idat = Buffer.alloc(dataSize + 12);
    idat.writeUInt32BE(dataSize, 0);
    idat.write('IDAT', 4);
    
    // Remplir avec une couleur unie (noir par défaut)
    for (let y = 0; y < height; y++) {
        const rowOffset = 8 + y * rowSize;
        idat.writeUInt8(0, rowOffset); // filter byte
        for (let x = 0; x < width; x++) {
            const pixelOffset = rowOffset + 1 + x * 3;
            idat.writeUInt8(10, pixelOffset);     // R
            idat.writeUInt8(10, pixelOffset + 1); // G
            idat.writeUInt8(11, pixelOffset + 2); // B
        }
    }
    
    // IEND chunk
    const iend = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44]);
    
    return Buffer.concat([signature, ihdr, idat, iend]);
}

// Créer les screenshots
const screenshots = [
    { name: 'mobile-feed.png', width: 390, height: 844 },
    { name: 'mobile-chat.png', width: 390, height: 844 },
    { name: 'desktop-feed.png', width: 1200, height: 630 },
];

const screenshotDir = path.join(__dirname, 'assets', 'screenshots');
if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
}

console.log('Création des screenshots PNG...');

screenshots.forEach(({ name, width, height }) => {
    const pngBuffer = createBasicPNG(width, height);
    const filePath = path.join(screenshotDir, name);
    fs.writeFileSync(filePath, pngBuffer);
    console.log(`✓ Créé ${name} (${width}x${height})`);
});

console.log('✅ Screenshots créés avec succès !');