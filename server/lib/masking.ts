// server/lib/masking.ts
import vision from '@google-cloud/vision';
import sharp from 'sharp';

// 1. 구글 비전 클라이언트 초기화 (.env 연동)
const client = new vision.ImageAnnotatorClient();

/**
 * 이미지 버퍼를 받아 얼굴과 민감 텍스트를 블러 처리한 후, "원본 포맷 그대로" Base64로 반환하는 함수
 */
export async function maskSensitiveInfo(imageBuffer: Buffer): Promise<string> {
  try {
    const [faceResult] = await client.faceDetection(imageBuffer);
    const [textResult] = await client.textDetection(imageBuffer);

    const faces = faceResult.faceAnnotations || [];
    const texts = textResult.textAnnotations || [];

    let currentImage = sharp(imageBuffer);

    // ✨ [핵심] 이미지의 원래 포맷(확장자) 알아내기 (jpeg, png, webp 등)
    const metadata = await currentImage.metadata();
    const format = metadata.format || 'jpeg'; // 알아내지 못하면 기본값 jpeg

    // 얼굴 진짜 블러 처리
    for (const face of faces) {
      const vertices = face.boundingPoly?.vertices;
      if (vertices && vertices.length === 4) {
        const x = vertices[0].x || 0;
        const y = vertices[0].y || 0;
        const width = (vertices[1].x || 0) - x;
        const height = (vertices[2].y || 0) - y;

        const blurredFaceRegion = await sharp(imageBuffer)
          .extract({ left: x, top: y, width, height })
          .blur(15)
          .toBuffer();

        currentImage = currentImage.composite([
          { input: blurredFaceRegion, top: y, left: x },
        ]);
      }
    }

    // 민감 텍스트(주민번호 등) 진짜 블러 처리
    const sensitiveRegex = /(\d{6}[-]\d{7})|(\d{4}[-]\d{4}[-]\d{4}[-]\d{4})/g;
    for (const text of texts) {
      if (sensitiveRegex.test(text.description || '')) {
        const vertices = text.boundingPoly?.vertices;
        if (vertices && vertices.length === 4) {
          const x = vertices[0].x || 0;
          const y = vertices[0].y || 0;
          const width = (vertices[1].x || 0) - x;
          const height = (vertices[2].y || 0) - y;

          const blurredTextRegion = await sharp(imageBuffer)
            .extract({ left: x, top: y, width, height })
            .blur(15)
            .toBuffer();

          currentImage = currentImage.composite([
            { input: blurredTextRegion, top: y, left: x },
          ]);
        }
      }
    }

    // ✨ 원본 포맷(format) 그대로 유지하면서 화질 최적화(80) 적용
    const outputBuffer = await currentImage
      .toFormat(format as keyof sharp.FormatEnum, { quality: 80 })
      .toBuffer();

    // 포맷에 맞춰서 프론트가 읽을 수 있는 MIME 타입 생성 (예: image/png)
    const mimeType = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;

    return `data:${mimeType};base64,${outputBuffer.toString('base64')}`;
  } catch (error) {
    console.error('마스킹 처리 중 에러 발생:', error);
    // 에러 시 원본 이미지를 그대로 반환 (안전 장치)
    return `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
  }
}
