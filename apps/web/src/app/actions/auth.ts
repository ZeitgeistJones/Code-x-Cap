"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminCookieName, getExpectedAdminKey } from "@/lib/auth";

export async function unlockAction(formData: FormData) {
  const key = String(formData.get("adminKey") ?? "");
  const expected = getExpectedAdminKey();
  if (!expected) {
    throw new Error("ADMIN_KEY is not configured on the server");
  }
  if (key !== expected) {
    redirect("/unlock?error=1");
  }
  const jar = await cookies();
  jar.set(adminCookieName(), key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export async function lockAction() {
  const jar = await cookies();
  jar.delete(adminCookieName());
  redirect("/unlock");
}
