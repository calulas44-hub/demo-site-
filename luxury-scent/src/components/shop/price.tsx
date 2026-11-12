import { formatPrice } from "@/lib/money";

export function Price({ cents }: { cents: number }) {
  return <>{formatPrice(cents)}</>;
}
