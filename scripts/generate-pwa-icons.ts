/**
 * PWA 아이콘 생성 스크립트
 *
 * client/public/icons/icon.svg 를 기반으로 PNG 아이콘을 생성합니다.
 * sharp 패키지(이미 dependencies에 포함)를 사용합니다.
 *
 * 사용법:
 *   npm run pwa:icons
 */
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const iconsDir = path.resolve(rootDir, "client", "public", "icons");
const srcSvg = path.resolve(iconsDir, "icon.svg");

const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-180x180.png", size: 180 }, // iOS apple-touch-icon
];

async function generateIcons() {
  console.log("🎨 PWA 아이콘 생성 시작...");
  console.log(`   소스: ${srcSvg}\n`);

  for (const { name, size } of targets) {
    const outputPath = path.resolve(iconsDir, name);
    await sharp(srcSvg)
      .resize(size, size)
      .png({ quality: 90 })
      .toFile(outputPath);
    console.log(`   ✅ ${name} (${size}x${size}px) → ${outputPath}`);
  }

  console.log("\n🎉 아이콘 생성 완료!");
  console.log("   생성된 파일들:");
  targets.forEach(({ name }) =>
    console.log(`   - client/public/icons/${name}`)
  );
}

generateIcons().catch((err) => {
  console.error("❌ 아이콘 생성 실패:", err);
  process.exit(1);
});
