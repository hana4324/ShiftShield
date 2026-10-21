import { z } from "zod";

const isUrl = (value: string): boolean => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

/** Absolute URL or mobile deep link (shiftshield://, exp://). */
export const RedirectUrl = z.string().min(1).max(2048).refine(isUrl, "must be an absolute URL or deep link");

export const Uuid = z.string().uuid();

export const Coordinate = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy_m: z.number().min(0).max(100_000).optional(),
});
