/**
 * PWA PNG 아이콘 생성 스크립트
 *
 * client/public/icons/ 에 있는 SVG 파일로부터
 * PWA 및 iOS 홈 화면에 필요한 PNG 아이콘을 생성합니다.
 *
 * 사용법:
 *   npm run pwa:icons
 *
 * 생성 결과:
 *   client/public/icons/icon-192.png    (Android 홈 화면 / manifest any)
 *   client/public/icons/icon-512.png    (스플래시 화면 / manifest any+maskable)
 *   client/public/icons/icon-180x180.png (iOS apple-touch-icon)
 */

import sharp from "sharp";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.resolve(__dirname, "../client/public/icons");

const ICON_SVG = path.join(iconsDir, "icon.svg");
const MASKABLE_SVG = path.join(iconsDir, "icon-maskable.svg");

interface IconTarget {
  src: string;   // 소스 SVG 경로
  dest: string;  // 출력 PNG 경로
  size: number;  // 정사각형 크기 (px)
  label: string; // 로그 표시용
}

const targets: IconTarget[] = [
  {
    src: ICON_SVG,
    dest: path.join(iconsDir, "icon-192.png"),
    size: 192,
    label: "icon-192.png  (manifest any)",
  },
  {
    src: MASKABLE_SVG,
    dest: path.join(iconsDir, "icon-512.png"),
    size: 512,
    label: "icon-512.png  (manifest any + maskable)",
  },
  {
    src: MASKABLE_SVG,
    dest: path.join(iconsDir, "icon-180x180.png"),
    size: 180,
    label: "icon-180x180.png  (iOS apple-touch-icon)",
  },
];

async function generateIcons(): Promise<void> {
  console.log("🎨 PWA 아이콘 생성 시작...\n");

  for (const target of targets) {
    if (!fs.existsSync(target.src)) {
      console.error(`❌ 소스 파일 없음: ${target.src}`);
      process.exit(1);
    }

    await sharp(target.src)
      .resize(target.size, target.size, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toFile(target.dest);

    console.log(`  ✅ ${target.label}`);
  }

  console.log("\n✨ 완료! client/public/icons/ 에 PNG 파일이 생성되었습니다.");
  console.log("   git add client/public/icons/*.png 으로 커밋에 포함시켜 주세요.\n");
}

generateIcons().catch((err) => {
  console.error("❌ 아이콘 생성 실패:", err);
  process.exit(1);
});
