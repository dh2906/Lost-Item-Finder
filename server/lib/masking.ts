import vision from "@google-cloud/vision";
import sharp from "sharp";

const client = new vision.ImageAnnotatorClient();

export async function maskSensitiveInfo(imageBuffer: Buffer): Promise<string> {
  try {
    const [faceResult] = await client.faceDetection(imageBuffer);
    const [textResult] = await client.textDetection(imageBuffer);

    const faces = faceResult.faceAnnotations || [];
    const texts = textResult.textAnnotations || [];

    const overlays: sharp.OverlayOptions[] = [];

    for (const face of faces) {
      const vertices = face.boundingPoly?.vertices;
      if (vertices && vertices.length === 4) {
        const xs = vertices.map((v) => v.x || 0);
        const ys = vertices.map((v) => v.y || 0);
        const left = Math.max(0, Math.min(...xs));
        const top = Math.max(0, Math.min(...ys));
        const width = Math.max(...xs) - left;
        const height = Math.max(...ys) - top;

        if (width > 0 && height > 0) {
          const blurredFace = await sharp(imageBuffer)
            .extract({ left, top, width, height })
            .blur(25) // 강력한 얼굴 모자이크
            .toBuffer();

          overlays.push({ input: blurredFace, top, left });
        }
      }
    }
    const safeWords = [
      // 1. 기본 신분증 종류
      "학생증",
      "주민등록증",
      "청소년증",
      "신분증",
      "운전면허증",
      "여권",
      "자격증",
      "복지카드",
      "외국인등록증",
      "국가유공자증",

      // 2. 학교/기관 관련
      "대학교",
      "대학",
      "총장",
      "공학부",
      "학부",
      "한국기술교육대",
      "고등학교",
      "중학교",
      "초등학교",
      "학교",
      "학생",
      "학과",
      "전공",
      "대학원",
      "교장",

      // 3. 금융/카드/은행
      "은행",
      "카드",
      "체크",
      "신용",
      "교통카드",
      // 시중은행
      "국민",
      "신한",
      "우리",
      "하나",
      "농협",
      "기업",
      "SC제일",
      "씨티",
      // 인터넷전문은행
      "카카오",
      "카카오뱅크",
      "토스",
      "토스뱅크",
      "케이뱅크",
      // 특수은행 및 제2금융권
      "수협",
      "새마을금고",
      "신협",
      "우체국",
      "산림조합",
      "저축은행",
      // 지방은행
      "부산",
      "경남",
      "대구",
      "광주",
      "전북",
      "제주",
      // 주요 전업 카드사
      "삼성카드",
      "현대카드",
      "롯데카드",
      "비씨카드",
      "비씨",
      // 자주 쓰이는 영문 표기
      "KB",
      "NH",
      "IBK",
      "SC",
      "BC",
      "Check",
      "Debit",
      "Bank",
      "Card",
      "Pay",
      "Credit",

      // 4. 문서 라벨
      "발급",
      "유효기한",
      "성명",
      "이름",
      "주소",
      "학번",
      "주민번호",
      "주민등록번호",
      "생년월일",
      "연락처",
      "전화번호",
      "면허번호",
      "등록번호",
      "기간",
      "VALID",
      "THRU",
      "MONTH",
      "YEAR",
      "MEMBER",
      "SINCE",

      // 5. 발급처/관공서
      "경찰청장",
      "구청장",
      "시장",
      "도지사",
      "군수",
      "특별시",
      "광역시",
    ];

    if (texts.length > 1) {
      for (let i = 1; i < texts.length; i++) {
        const content = texts[i].description || "";

        const hasNumber = /\d{4,}/.test(content);
        const isKoreanWord = /^[가-힣]{2,6}$/.test(content);
        const isSafeWord = safeWords.some((word) => content.includes(word));
        const isNameOrAddress = isKoreanWord && !isSafeWord;

        if (hasNumber || isNameOrAddress) {
          const vertices = texts[i].boundingPoly?.vertices;
          if (vertices && vertices.length === 4) {
            const xs = vertices.map((v) => v.x || 0);
            const ys = vertices.map((v) => v.y || 0);
            const left = Math.max(0, Math.min(...xs));
            const top = Math.max(0, Math.min(...ys));
            const width = Math.max(...xs) - left;
            const height = Math.max(...ys) - top;

            if (width > 5 && height > 5) {
              const blurredText = await sharp(imageBuffer)
                .extract({ left, top, width, height })
                .blur(18)
                .toBuffer();

              overlays.push({ input: blurredText, top, left });
            }
          }
        }
      }
    }

    let currentImage = sharp(imageBuffer);
    const metadata = await currentImage.metadata();
    const format = metadata.format || "jpeg";

    if (overlays.length > 0) {
      currentImage = currentImage.composite(overlays);
    }

    const outputBuffer = await currentImage
      .toFormat(format as keyof sharp.FormatEnum, { quality: 80 })
      .toBuffer();

    const mimeType = format === "jpeg" ? "image/jpeg" : `image/${format}`;
    return `data:${mimeType};base64,${outputBuffer.toString("base64")}`;
  } catch (error) {
    console.error("마스킹 처리 중 에러 발생:", error);
    return `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;
  }
}
