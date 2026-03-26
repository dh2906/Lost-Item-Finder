/**
 * [리다이렉트 파일]
 *
 * 이 파일은 canonical 스크립트인 script/generate-pwa-icons.ts 와
 * 중복되어 있습니다. 실제 구현은 script/ 디렉터리에서 관리됩니다.
 *
 * package.json의 pwa:icons 스크립트는 script/generate-pwa-icons.ts 를 실행합니다:
 *   "pwa:icons": "tsx script/generate-pwa-icons.ts"
 *
 * 이 파일은 추후 삭제 대상입니다. 로컬에서 아래 명령으로 제거해 주세요:
 *   git rm scripts/generate-pwa-icons.ts
 *   git commit -m "chore: 중복 스크립트 파일 제거 (scripts/ → script/ 통합)"
 */

// canonical 구현으로 위임합니다.
import "../script/generate-pwa-icons";
