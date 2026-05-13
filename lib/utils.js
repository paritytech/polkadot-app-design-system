// Naming and reference helpers used by every platform.

export const pascal = (s) =>
  s.replace(/(^|[\s_-])(\w)/g, (_, __, c) => c.toUpperCase());

export const camel = (s) => {
  const p = pascal(s);
  // Short all-uppercase abbreviations like XS, XXL, 3XL -> lower them whole
  if (/^[A-Z0-9]+$/.test(p)) return p.toLowerCase();
  return p.charAt(0).toLowerCase() + p.slice(1);
};

export const isReference = (v) =>
  typeof v === 'string' && v.startsWith('{') && v.endsWith('}');
