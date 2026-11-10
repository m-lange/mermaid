import { tr } from "../shared/strings";

/** Fügt ein Bild über die gemeinsame Office-API an der aktuellen Auswahl ein. */
export function setSelectedImage(
  base64: string,
  opts: { left?: number; top?: number; width?: number; height?: number } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const options: Office.SetSelectedDataOptions = { coercionType: Office.CoercionType.Image };
    if (opts.left !== undefined) options.imageLeft = opts.left;
    if (opts.top !== undefined) options.imageTop = opts.top;
    if (opts.width !== undefined) options.imageWidth = opts.width;
    if (opts.height !== undefined) options.imageHeight = opts.height;
    Office.context.document.setSelectedDataAsync(base64, options, (r) => {
      if (r.status === Office.AsyncResultStatus.Succeeded) resolve();
      else reject(new Error(r.error?.message || tr("imageInsertFailed")));
    });
  });
}
