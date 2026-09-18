import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cleanMathText(text: string | undefined | null): string {
  if (!text) return "";
  
  let cleaned = text;

  // Replace LaTeX backslash math/geometric codes with clean unicode
  cleaned = cleaned
    .replace(/\\phi/gi, 'Ø')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\pm/g, '±')
    .replace(/\\le/g, '≤')
    .replace(/\\ge/g, '≥')
    .replace(/\\approx/g, '≈')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pi/g, 'π')
    .replace(/\\degree/g, '°');

  // Convert sub/superscript patterns with brackets to plain representation (e.g. d_{max} -> d_max, d^{max} -> d^max)
  cleaned = cleaned.replace(/_\{([^}]+)\}/g, '_$1');
  cleaned = cleaned.replace(/\^\{([^}]+)\}/g, '^$1');

  // Remove double dollar signs $$
  cleaned = cleaned.replace(/\$\$/g, '');
  
  // Remove single dollar signs $
  cleaned = cleaned.replace(/\$/g, '');
  
  return cleaned;
}

