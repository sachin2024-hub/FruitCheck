import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type Source = 'camera' | 'gallery';
export type PendingImage = { uri: string; width: number; source: Source };
export type PickOutcome = { kind: 'ok'; image: PendingImage } | { kind: 'cancelled' } | { kind: 'invalid'; message: string };

// HEIC/HEIF are accepted because they are converted to JPEG before upload.
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_FILE_MB = 20;
const MIN_SIDE = 64;

/** Opens the system photo picker (needs no storage permission on Android) and validates the file. */
export async function pickFromGallery(): Promise<PickOutcome> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled || !result.assets?.[0]) return { kind: 'cancelled' };
  const a = result.assets[0];
  const mime = a.mimeType?.toLowerCase();
  if (mime && !ACCEPTED_TYPES.includes(mime)) {
    return { kind: 'invalid', message: 'This file type is not supported. Choose a JPEG, PNG, WebP or HEIC photo.' };
  }
  if (a.fileSize && a.fileSize > MAX_FILE_MB * 1024 * 1024) {
    return { kind: 'invalid', message: `This image is larger than ${MAX_FILE_MB} MB. Choose a smaller photo.` };
  }
  if (a.width && a.height && Math.min(a.width, a.height) < MIN_SIDE) {
    return { kind: 'invalid', message: 'This image is too small to classify. Choose a clearer photo.' };
  }
  return { kind: 'ok', image: { uri: a.uri, width: a.width, source: 'gallery' } };
}

/** Screen rectangle (in the camera view's own coordinates) that the on-screen guide frame occupies. */
export type GuideRect = { x: number; y: number; size: number; viewWidth: number; viewHeight: number };

const GUIDE_MARGIN = 0.12; // keep a little context around the guide so the fruit is not clipped

/** Crops a camera photo to what the guide frame shows. The preview fills the view (cover), so the
 *  guide maps onto the photo with one scale factor. Without this the whole 4:3 photo, including
 *  the sides the preview never showed, would be squashed into the model's square input.
 *  Falls back to the original photo if anything fails. */
export async function cropToGuide(uri: string, guide: GuideRect): Promise<PendingImage | null> {
  try {
    const ctx = ImageManipulator.ImageManipulator.manipulate(uri);
    const full = await ctx.renderAsync(); // EXIF orientation is applied, so width/height match what the user saw
    const scale = Math.max(guide.viewWidth / full.width, guide.viewHeight / full.height);
    const offX = (full.width * scale - guide.viewWidth) / 2;
    const offY = (full.height * scale - guide.viewHeight) / 2;
    const side = Math.min((guide.size * (1 + 2 * GUIDE_MARGIN)) / scale, full.width, full.height);
    const cx = (guide.x + guide.size / 2 + offX) / scale;
    const cy = (guide.y + guide.size / 2 + offY) / scale;
    const originX = Math.round(Math.min(Math.max(cx - side / 2, 0), full.width - side));
    const originY = Math.round(Math.min(Math.max(cy - side / 2, 0), full.height - side));
    const crop = ImageManipulator.ImageManipulator.manipulate(uri).crop({
      originX,
      originY,
      width: Math.round(side),
      height: Math.round(side),
    });
    const saved = await (await crop.renderAsync()).saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.92 });
    return { uri: saved.uri, width: saved.width, source: 'camera' };
  } catch (e) {
    console.log('[FruitCheck] Cropping to guide failed, using full photo:', (e as Error).message);
    return null;
  }
}

const MAX_WIDTH = 1024;

/** Converts to JPEG (and downscales large photos) before upload. The backend resizes to 224px,
 *  so this only saves bandwidth. Falls back to the original file if it fails. */
export async function prepareForUpload(uri: string, width: number): Promise<string> {
  try {
    const ctx = ImageManipulator.ImageManipulator.manipulate(uri);
    if (width > MAX_WIDTH) ctx.resize({ width: MAX_WIDTH });
    const rendered = await ctx.renderAsync();
    const saved = await rendered.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.9 });
    return saved.uri;
  } catch (e) {
    console.log('[FruitCheck] Image conversion failed, uploading original:', (e as Error).message);
    return uri;
  }
}

// Selected image handed from the scan/gallery flow to the preview and result screens.
let pending: PendingImage | null = null;
export const setPending = (p: PendingImage | null) => {
  pending = p;
};
export const getPending = () => pending;
