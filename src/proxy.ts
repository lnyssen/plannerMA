import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PUBLIC_PATHS = ["/connexion"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isLoggedIn = !!req.auth;

  if (!isLoggedIn && !isPublic) {
    const url = new URL("/connexion", req.nextUrl.origin);
    url.searchParams.set("depuis", pathname);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && isPublic) {
    return NextResponse.redirect(new URL("/projets", req.nextUrl.origin));
  }

  if (isLoggedIn && pathname.startsWith("/reglages") && req.auth?.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/projets", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // Exclut aussi tout chemin avec une extension de fichier (logo, polices…) :
  // sans ça, la page de connexion elle-même ne pouvait pas charger son
  // propre logo — la requête de l'image se faisait rediriger vers
  // /connexion comme n'importe quelle route protégée.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\..*).*)"],
};
