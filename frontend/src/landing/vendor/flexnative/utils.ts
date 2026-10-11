// Adapted from Flexnative (AGPL-3.0); see NOTICE.md for source and changes.
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
