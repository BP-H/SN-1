import { API_BASE_URL } from "@/utils/apiBase";
import { requireBackendAuthSession } from "@/utils/authSession";

export async function sellerApi(path, method = "GET", body) {
  const { token } = requireBackendAuthSession();
  const headers = { Authorization: "Bearer " + token };
  if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(API_BASE_URL + "/commerce/me" + path, {
    method, headers, body: body instanceof FormData ? body : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) {
    const detail = Array.isArray(data.detail) ? data.detail[0]?.msg : data.detail;
    throw new Error(detail || "Could not update the shop.");
  }
  return data;
}
