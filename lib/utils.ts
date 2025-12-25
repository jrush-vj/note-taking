type ClassLike = string | undefined | null | false;

function isPresent(value: ClassLike): value is string {
  return Boolean(value);
}

// Simple class name combiner used across UI components
export function cn(...classes: ClassLike[]): string {
  return classes.filter(isPresent).join(" ");
}