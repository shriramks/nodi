"use client";

import { useState } from "react";

type TraktConnectButtonProps = {
  connected: boolean;
};

export function TraktConnectButton({ connected }: TraktConnectButtonProps) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={() => setPending(true)}
      className="flex w-full items-center py-3 text-[15px] font-semibold text-accent disabled:opacity-50"
    >
      {pending ? "Connecting…" : connected ? "Reconnect Trakt" : "Authorize Trakt"}
    </button>
  );
}
