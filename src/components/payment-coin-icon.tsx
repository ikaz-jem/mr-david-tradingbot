"use client";
import { useState } from "react";
import { paymentCoinIcon } from "@/lib/payment-display";

export function PaymentCoinIcon({ code, logo, size = 32 }: { code: string; logo?: string; size?: number }) {
  const src = paymentCoinIcon(code, logo);
  const [failed, setFailed] = useState("");
  return <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-black" style={{ width: size, height: size }} aria-hidden="true">
    {src && failed !== src ? /* Provider-owned SVG rendered as an image, not injected markup. */
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(src)}/> : code.slice(0, 3).toUpperCase()}
  </span>;
}
