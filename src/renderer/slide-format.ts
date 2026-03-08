export const SLIDE_FORMATS = ["short-form", "widescreen"] as const;
export type SlideFormat = (typeof SLIDE_FORMATS)[number];

export type SlideCanvas = {
  width: number;
  height: number;
};

export const LEGACY_CANVAS: SlideCanvas = { width: 1080, height: 1440 };

export function getCanvasForFormat(format: SlideFormat): SlideCanvas {
  if (format === "widescreen") {
    return { width: 1920, height: 1080 };
  }
  return { width: 1080, height: 1920 };
}
