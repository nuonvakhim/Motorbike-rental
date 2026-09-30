"use server";

/**
 * Lesson: "Authentication" — signup, login and logout as Server Actions.
 *
 * Server Actions are public endpoints: anything here can be invoked without
 * going through our form, so every action re-validates its own input and does
 * its own authorization. Running on the server is also what lets us touch the
 * password hash and the signing secret at all.
 *
 * Both forms carry a hidden `next` field, so a tourist sent to /login from a
 * bike's booking form comes back to that bike instead of to a dashboard.
 */

import { redirect } from "next/navigation";

import {
  LoginFormSchema,
  SignupFormSchema,
  homeFor,
  safeNextPath,
  type FormState,
} from "@/lib/definitions";
import { clientIp, rateLimit, tooManyMessage } from "@/lib/rate-limit";
import { createSession, deleteSession } from "@/lib/session";
import {
  createUser,
  getUserByEmail,
  toPublicUser,
  verifyPassword,
} from "@/lib/users";

export async function signup(
  state: FormState,
  formData: FormData,
): Promise<FormState> {
  // 1. Validate form fields
  const validatedFields = SignupFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    accountType: formData.get("accountType"),
  });

  // Return early if any field fails, before touching the database.
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  // 2. Limit how many accounts one address can open — each one also costs
  //    a bcrypt hash.
  const limited = rateLimit(`signup:${await clientIp()}`, 5, 60 * 60_000);
  if (!limited.ok) return { message: tooManyMessage(limited) };

  // 3. Prepare data for insertion into database
  const { name, email, password, accountType } = validatedFields.data;

  // 4. Insert the user into the database (hashing happens in createUser)
  const result = await createUser({ name, email, password, role: accountType });

  if (!result.ok) {
    return result.reason === "email-taken"
      ? { errors: { email: ["An account with this email already exists — log in instead."] } }
      : { message: "We could not create your account right now. Please try again." };
  }

  const { user } = result;

  // 5. Create user session
  await createSession(user.id, user.role);

  // 6. Redirect user — outside any try/catch, because redirect() works by
  //    throwing a special error that Next.js catches.
  redirect(safeNextPath(formData.get("next")) ?? homeFor(user.role));
}

export async function login(
  state: FormState,
  formData: FormData,
): Promise<FormState> {
  const validatedFields = LoginFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { email, password } = validatedFields.data;

  // Checked before bcrypt runs, so a flood of guesses is turned away
  // cheaply. Per address stops one client trying many accounts; per email
  // stops many clients trying one account.
  const byIp = rateLimit(`login-ip:${await clientIp()}`, 30, 15 * 60_000);
  const byEmail = rateLimit(`login-email:${email.toLowerCase()}`, 10, 15 * 60_000);
  const blocked = !byIp.ok ? byIp : !byEmail.ok ? byEmail : null;
  if (blocked) return { message: tooManyMessage(blocked) };

  const user = await getUserByEmail(email);

  /**
   * One message for "no such user" and for "wrong password". Telling them
   * apart would let an attacker enumerate which emails have accounts.
   */
  const invalid = { message: "Invalid email or password." };

  if (!user) return invalid;
  if (!(await verifyPassword(user, password))) return invalid;

  // `user` is the full row; narrow it before anything leaves the server.
  const { id, role } = toPublicUser(user);
  await createSession(id, role);

  redirect(safeNextPath(formData.get("next")) ?? homeFor(role));
}

export async function logout() {
  await deleteSession();
  redirect("/");
}
