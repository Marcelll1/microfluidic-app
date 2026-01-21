"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);//UI prejde do logging out modu pri odhlasovani

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });//posle poziadavku na odhlasenie
    } finally {//aj ked sa nepodari, pokusi sa presmerovat na login
      setLoading(false);//ukonci loading stav
      router.replace("/login");//presmeruje na login stranku
    }
  }

  return (
    <button
      onClick={logout}//spusti logout funkciu pri kliknuti
      className="text-sm text-slate-400 hover:text-red-400"
      disabled={loading}
    >
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
}
