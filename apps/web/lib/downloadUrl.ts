const CLOUDINARY_DELIVERY =
  /^(https:\/\/res\.cloudinary\.com\/[^/]+\/[^/]+\/upload\/)(.*?)([^/?]+)(\.[a-z0-9]+)(\?.*)?$/i;

export function downloadUrl(url: string): string {
  const match = url.match(CLOUDINARY_DELIVERY);
  if (!match) return url;
  const [, base, path, name, ext, query = ''] = match;
  const filename = name.replace(/[^\w-]/g, '-');
  return `${base}fl_attachment:${filename}/${path}${name}${ext}${query}`;
}
