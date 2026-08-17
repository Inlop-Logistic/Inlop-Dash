/**
 * KARAM · auth.js — Login local, contraseña con hash (nunca texto plano)
 * -----------------------------------------------------------------------
 * SHA-256 con salt aleatorio por usuario, usando Web Crypto (SubtleCrypto).
 * No es bcrypt/argon2 (no disponibles nativamente en browser sin libs
 * externas), pero cumple el requisito de "nunca contraseña en texto
 * plano" para una V1 local. Documentado como decisión menor.
 * -----------------------------------------------------------------------
 */
(function (global) {
  const SESSION_KEY = 'karam_session';

  function bufToHex(buf) {
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function randomSalt() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return bufToHex(arr);
  }

  async function sha256(text) {
    const enc = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', enc);
    return bufToHex(digest);
  }

  async function hashPassword(password, salt) {
    const s = salt || randomSalt();
    const hash = await sha256(s + ':' + password);
    return { hash, salt: s };
  }

  async function verifyPassword(password, salt, expectedHash) {
    const { hash } = await hashPassword(password, salt);
    return hash === expectedHash;
  }

  async function login(username, password) {
    const users = await KaramRepo.users.all();
    const user = users.find((u) => u.username.toLowerCase() === String(username).toLowerCase());
    if (!user) return { ok: false, error: 'Usuario no encontrado' };
    const valid = await verifyPassword(password, user.salt, user.passwordHash);
    if (!valid) return { ok: false, error: 'Contraseña incorrecta' };
    const session = { userId: user.id, username: user.username, name: user.name, role: user.role, loginAt: Date.now() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { ok: true, session };
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function changePassword(userId, newPassword) {
    const { hash, salt } = await hashPassword(newPassword);
    return KaramRepo.users.update(userId, { passwordHash: hash, salt });
  }

  global.KaramAuth = { hashPassword, verifyPassword, login, logout, getSession, changePassword };
})(window);
