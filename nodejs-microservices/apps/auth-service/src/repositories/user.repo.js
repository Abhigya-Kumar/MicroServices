import { getPool } from "shared";

export async function findByEmail(email) {
  const result = await getPool().query(
    `
        SELECT id, name, email, password_hash, role, created_at
        FROM users
        WHERE email = $1
        
        `,
    [email],
  );

  return result.rows[0] ?? null;
}

export async function findById(id) {
  const result = await getPool().query(
    `
        SELECT id, name, email, password_hash, role, created_at
        FROM users
        WHERE id = $1
        
        `,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function createUser(input) {
  const result = await getPool().query(
    `
        INSERT INTO users (name, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, email, password_hash, role, created_at
        
        `,
    [input.name, input.email, input.passwordHash, input.role ?? "USER"],
  );

  return result.rows[0];
}
