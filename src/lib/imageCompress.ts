/** 에이전트로 보내는 이미지 첨부(일정 이미지 등록, 메모 텍스트 추출)를 base64로 인코딩하기
 * 전에 canvas로 리사이즈+재인코딩해 페이로드를 줄인다. Next.js API 라우트(에이전트 프록시)가
 * Vercel에 배포되면 요청 바디가 4.5MB로 제한되는데, 스마트폰 카메라 원본 사진은 base64로
 * 인코딩하면 그 한도를 쉽게 넘기 때문에 클라이언트에서 미리 줄여 보내는 게 목적이다. */

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("파일을 읽을 수 없어요."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 불러올 수 없어요."));
    img.src = dataUrl;
  });
}

/** 장변이 MAX_DIMENSION을 넘으면 비율 유지한 채 축소하고, 항상 JPEG 품질 JPEG_QUALITY로
 * 다시 인코딩한다(원본이 PNG 등이어도 압축 목적상 JPEG로 통일). */
async function resizeAndCompress(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const longSide = Math.max(img.width, img.height);
  const scale = longSide > MAX_DIMENSION ? MAX_DIMENSION / longSide : 1;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 컨텍스트를 만들 수 없어요.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

/** 이미지 파일을 base64 data URL로 반환한다. 가능하면 canvas로 리사이즈+압축한 결과를 쓰고,
 * 압축 결과가 오히려 원본보다 크거나(이미 작고 압축률이 안 좋은 이미지 등) canvas 처리 자체가
 * 실패하면(SVG, 구형 브라우저 등) 원본 data URL을 그대로 반환한다. */
export async function compressImage(file: File): Promise<string> {
  const originalDataUrl = await fileToDataUrl(file);

  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return originalDataUrl;
  }

  try {
    const compressed = await resizeAndCompress(originalDataUrl);
    return compressed.length < originalDataUrl.length ? compressed : originalDataUrl;
  } catch {
    return originalDataUrl;
  }
}
