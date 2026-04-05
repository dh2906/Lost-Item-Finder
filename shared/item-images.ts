export const MAX_ITEM_IMAGE_COUNT = 10;

type ItemImageSource = {
  imageUrl?: string | null;
  imageUrls?: string[] | null;
};

function normalizeImageUrl(imageUrl?: string | null): string | null {
  if (typeof imageUrl !== "string") {
    return null;
  }

  const trimmed = imageUrl.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeItemImageUrls(source: ItemImageSource): string[] {
  const normalizedUrls: string[] = [];

  const pushUnique = (imageUrl?: string | null) => {
    const normalizedImageUrl = normalizeImageUrl(imageUrl);
    if (!normalizedImageUrl || normalizedUrls.includes(normalizedImageUrl)) {
      return;
    }

    normalizedUrls.push(normalizedImageUrl);
  };

  if (Array.isArray(source.imageUrls)) {
    source.imageUrls.forEach((imageUrl) => pushUnique(imageUrl));
  }

  pushUnique(source.imageUrl);

  return normalizedUrls.slice(0, MAX_ITEM_IMAGE_COUNT);
}

export function getPrimaryItemImageUrl(source: ItemImageSource): string | undefined {
  return normalizeItemImageUrls(source)[0];
}
