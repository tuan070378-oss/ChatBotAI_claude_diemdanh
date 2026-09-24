import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cleanMathText(text: string | undefined | null): string {
  if (!text) return "";
  
  let cleaned = text;

  // 1. Remove LaTeX enclosing brackets and dollar signs
  cleaned = cleaned.replace(/\\\[/g, '').replace(/\\\]/g, '');
  cleaned = cleaned.replace(/\\\(|\\\)/g, '');
  cleaned = cleaned.replace(/\$\$/g, '').replace(/\$/g, '');

  // 2. Fractions: \frac{a}{b} -> (a / b)
  cleaned = cleaned.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)');

  // 3. LaTeX math symbols & operators
  cleaned = cleaned
    .replace(/\\pm(?![a-zA-Z])/g, '±')
    .replace(/\\times(?![a-zA-Z])/g, '×')
    .replace(/\\div(?![a-zA-Z])/g, '÷')
    .replace(/\\approx(?![a-zA-Z])/g, '≈')
    .replace(/\\(?:le|leq)(?![a-zA-Z])/g, '≤')
    .replace(/\\(?:ge|geq)(?![a-zA-Z])/g, '≥')
    .replace(/\\(?:ne|neq)(?![a-zA-Z])/g, '≠')
    .replace(/\\(?:to|rightarrow)(?![a-zA-Z])/g, '→')
    .replace(/\\infty(?![a-zA-Z])/g, '∞')
    .replace(/\\degree(?![a-zA-Z])/g, '°')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\sqrt(?![a-zA-Z])/g, '√');

  // 4. LaTeX Greek letters
  cleaned = cleaned
    .replace(/\\tau(?![a-zA-Z])/g, 'τ')
    .replace(/\\sigma(?![a-zA-Z])/g, 'σ')
    .replace(/\\Sigma(?![a-zA-Z])/g, 'Σ')
    .replace(/\\alpha(?![a-zA-Z])/g, 'α')
    .replace(/\\beta(?![a-zA-Z])/g, 'β')
    .replace(/\\gamma(?![a-zA-Z])/g, 'γ')
    .replace(/\\Gamma(?![a-zA-Z])/g, 'Γ')
    .replace(/\\delta(?![a-zA-Z])/g, 'δ')
    .replace(/\\Delta(?![a-zA-Z])/g, 'Δ')
    .replace(/\\epsilon(?![a-zA-Z])/g, 'ε')
    .replace(/\\eta(?![a-zA-Z])/g, 'η')
    .replace(/\\theta(?![a-zA-Z])/g, 'θ')
    .replace(/\\lambda(?![a-zA-Z])/g, 'λ')
    .replace(/\\Lambda(?![a-zA-Z])/g, 'Λ')
    .replace(/\\mu(?![a-zA-Z])/g, 'μ')
    .replace(/\\omega(?![a-zA-Z])/g, 'ω')
    .replace(/\\Omega(?![a-zA-Z])/g, 'Ω')
    .replace(/\\rho(?![a-zA-Z])/g, 'ρ')
    .replace(/\\pi(?![a-zA-Z])/g, 'π')
    .replace(/\\phi(?![a-zA-Z])/g, 'φ');

  // 5. Plain comparison operators & shorthand notations in Excel (<=, >=, !=, +/-, ->)
  cleaned = cleaned
    .replace(/<=|=</g, '≤')
    .replace(/>=|=>/g, '≥')
    .replace(/!=|<>/g, '≠')
    .replace(/\+\/-/g, '±')
    .replace(/->/g, '→');

  // 6. Plain-text Greek letters commonly used in engineering formulas (tau, sigma, etc.)
  // Context match: not part of a longer word
  const lookahead = '(?=[_=\\s\\[\\]\\(\\)\\+\\-\\*\\/\\^<>,;:]|$)';
  const lookbehind = '(?<=[^a-zA-Z]|^)';
  
  cleaned = cleaned
    .replace(new RegExp(lookbehind + 'tau' + lookahead, 'gi'), 'τ')
    .replace(new RegExp(lookbehind + 'sigma' + lookahead, 'gi'), 'σ')
    .replace(new RegExp(lookbehind + 'omega' + lookahead, 'gi'), 'ω')
    .replace(new RegExp(lookbehind + 'gamma' + lookahead, 'gi'), 'γ')
    .replace(new RegExp(lookbehind + 'lambda' + lookahead, 'gi'), 'λ')
    .replace(new RegExp(lookbehind + 'alpha' + lookahead, 'gi'), 'α')
    .replace(new RegExp(lookbehind + 'beta' + lookahead, 'gi'), 'β')
    .replace(new RegExp(lookbehind + 'theta' + lookahead, 'gi'), 'θ')
    .replace(new RegExp(lookbehind + 'delta' + lookahead, 'g'), 'δ')
    .replace(new RegExp(lookbehind + 'Delta' + lookahead, 'g'), 'Δ');

  // 7. Mechanical engineering notations:
  // Wo or W0 (Section modulus in torsion/bending) -> W₀
  cleaned = cleaned.replace(/\bW[o0]\b/g, 'W₀');

  // Remove curly braces in subscripts/superscripts: _{x} -> _x, ^{2} -> ^2
  cleaned = cleaned.replace(/_\{([^}]+)\}/g, '_$1');
  cleaned = cleaned.replace(/\^\{([^}]+)\}/g, '^$1');

  // Superscripts: ^2 -> ², ^3 -> ³, ^0 -> ⁰, ^1 -> ¹, ^4 -> ⁴, ^n -> ⁿ
  const supMap: Record<string, string> = { '0':'⁰', '1':'¹', '2':'²', '3':'³', '4':'⁴', '5':'⁵', '6':'⁶', '7':'⁷', '8':'⁸', '9':'⁹', 'n':'ⁿ' };
  cleaned = cleaned.replace(/\^([0-9n])/g, (_, d) => supMap[d] || '^' + d);

  // Subscript numbers & single index letters: _0 -> ₀, _1 -> ₁, _x -> ₓ, _X -> ₓ
  const subMap: Record<string, string> = { '0':'₀', '1':'₁', '2':'₂', '3':'₃', '4':'₄', '5':'₅', '6':'₆', '7':'₇', '8':'₈', '9':'₉', 'x':'ₓ', 'X':'ₓ' };
  cleaned = cleaned.replace(/_([0-9xX])(?![a-zA-Z0-9])/g, (_, d) => subMap[d] || '_' + d);

  return cleaned;
}

