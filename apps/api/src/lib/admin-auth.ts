import { createHash, randomBytes } from "node:crypto";

export type AdminRole = "EDITOR" | "ADMINISTRATOR";

export interface AdminIdentity {
  id: string;
  email: string;
  role: AdminRole;
}

export interface AdminCredentialRepository {
  findByCredentialHash(hash: string): Promise<AdminIdentity | null>;
}

export interface AdminUserView extends AdminIdentity {
  createdAt: string;
  lastLoginAt: string | null;
}

export type AdminDeleteResult =
  "deleted" | "self" | "last-administrator" | "not-found";

export interface AdminUserRepository {
  list(): Promise<AdminUserView[]>;
  create(
    email: string,
    role: AdminRole,
    credentialHash: string,
  ): Promise<AdminUserView>;
  findById(id: string): Promise<AdminUserView | null>;
  rotateCredential(id: string, credentialHash: string): Promise<void>;
  deleteIfAllowed(
    id: string,
    currentUserId: string,
  ): Promise<AdminDeleteResult>;
}

export interface AdminCredential {
  token: string;
  hash: string;
}

export function sha256Token(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createAdminCredential(): AdminCredential {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: sha256Token(token) };
}

export async function authenticateBearerToken(
  authorization: string | undefined,
  repository: AdminCredentialRepository,
): Promise<AdminIdentity | null> {
  const match = authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
  if (!match?.[1]) return null;

  return repository.findByCredentialHash(sha256Token(match[1]));
}
