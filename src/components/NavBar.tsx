"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function NavBar({ name, admin }: { name: string; admin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const links = [
    { href: "/", label: "Fixture" },
    { href: "/ranking", label: "Ranking" },
    ...(admin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <header
      className="z-30 bg-white/90 backdrop-blur-md border-line
                 fixed inset-x-0 bottom-0 border-t shadow-[0_-4px_16px_-8px_rgba(7,50,35,0.25)]
                 sm:sticky sm:top-0 sm:bottom-auto sm:border-t-0 sm:border-b sm:shadow-none"
    >
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-2 sm:gap-4">
        <Link href="/" className="hidden sm:flex font-extrabold items-center gap-2 shrink-0 text-foreground">
          <span className="text-xl">⚽</span>
          <span>Mundial <span className="text-primary">2026</span></span>
        </Link>

        <nav className="flex items-center gap-1 flex-1 justify-around sm:flex-none sm:justify-start">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold transition ${
                  active ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-[#eef4f1]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-muted hidden sm:inline">Hola, {name}</span>
          <button onClick={logout} className="btn btn-ghost text-sm py-1.5">
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
