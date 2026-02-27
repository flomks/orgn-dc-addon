// Generate simple Discord-themed icons for the extension
const fs = require('fs');
const path = require('path');

// Simple SVG icon for Discord Rich Presence
function generateSVGIcon(size) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#5865F2"/>
  <path d="M ${size * 0.3} ${size * 0.4} Q ${size * 0.5} ${size * 0.35} ${size * 0.7} ${size * 0.4} L ${size * 0.7} ${size * 0.6} Q ${size * 0.5} ${size * 0.7} ${size * 0.3} ${size * 0.6} Z" fill="white"/>
  <circle cx="${size * 0.4}" cy="${size * 0.48}" r="${size * 0.05}" fill="#5865F2"/>
  <circle cx="${size * 0.6}" cy="${size * 0.48}" r="${size * 0.05}" fill="#5865F2"/>
</svg>`;
}

const sizes = [16, 32, 48, 128];
const iconsDir = path.join(__dirname, '../extension/icons');

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG icons
sizes.forEach(size => {
  const svg = generateSVGIcon(size);
  const filename = path.join(iconsDir, `icon${size}.svg`);
  fs.writeFileSync(filename, svg);
  console.log(`Generated ${filename}`);
});

// For browsers that need PNG, we'll create simple colored squares
// In production, you'd use a proper image conversion tool
const Canvas = require('canvas');

sizes.forEach(size => {
  try {
    const canvas = Canvas.createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#5865F2';
    ctx.roundRect(0, 0, size, size, size * 0.2);
    ctx.fill();
    
    // Simple Discord-like shape
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.moveTo(size * 0.3, size * 0.4);
    ctx.quadraticCurveTo(size * 0.5, size * 0.35, size * 0.7, size * 0.4);
    ctx.lineTo(size * 0.7, size * 0.6);
    ctx.quadraticCurveTo(size * 0.5, size * 0.7, size * 0.3, size * 0.6);
    ctx.closePath();
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = '#5865F2';
    ctx.beginPath();
    ctx.arc(size * 0.4, size * 0.48, size * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(size * 0.6, size * 0.48, size * 0.05, 0, Math.PI * 2);
    ctx.fill();
    
    const buffer = canvas.toBuffer('image/png');
    const filename = path.join(iconsDir, `icon${size}.png`);
    fs.writeFileSync(filename, buffer);
    console.log(`Generated ${filename}`);
  } catch (error) {
    console.error(`Could not generate PNG icon (canvas not available), using SVG fallback:`, error.message);
    // Fallback: copy SVG as PNG (browsers usually support SVG)
    const svg = generateSVGIcon(size);
    const filename = path.join(iconsDir, `icon${size}.png`);
    fs.writeFileSync(filename, svg);
  }
});

console.log('Icons generated successfully!');
