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
      "학생증",
      "주민등록증",
      "청소년증",
      "신분증",
      "운전면허증",
      "대학교",
      "대학",
      "총장",
      "신한카드",
      "카드",
      "체크",
      "공학부",
      "학부",
      "은행",
      "발급",
      "유효기한",
      "성명",
      "이름",
      "주소",
      "학번",
      "Check",
      "Debit",
      "한국기술교육대",
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
