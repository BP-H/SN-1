import { API_BASE_URL } from "@/utils/apiBase";

export const money = (cents) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD",
}).format(cents / 100);

export function editionLabel(piece) {
  if (piece.kind === "digital") return "Digital download";
  return piece.edition === 1 ? "One of one" : "Edition of " + piece.edition;
}

export function availability(piece) {
  if (piece.edition !== null && piece.sold >= piece.edition) return "Sold";
  if (!piece.published) return "Archived";
  if (piece.remaining === 0) return "Held in checkout";
  return money(piece.price);
}

export async function catalog(path) {
  try {
    const res = await fetch(API_BASE_URL + "/commerce/" + path, {
      cache: "no-store", signal: AbortSignal.timeout(6500),
    });
    if (res.status === 404 || res.status === 422) return { missing: true };
    if (!res.ok) return { offline: true };
    return { data: await res.json() };
  } catch {
    return { offline: true };
  }
}
