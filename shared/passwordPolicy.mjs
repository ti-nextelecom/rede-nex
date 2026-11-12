// Same password requirements for self service, temporary passwords and reset.
export function validatePasswordComplexity(password) {
  if (typeof password !== 'string') return 'Informe uma senha válida.';
  if (password.length < 8) return 'A senha precisa ter pelo menos 8 caracteres';
  if (password.length > 128) return 'A senha deve ter no máximo 128 caracteres';
  if (!/[A-Z]/.test(password)) return 'A senha precisa ter pelo menos uma letra maiúscula';
  if (!/[0-9]/.test(password)) return 'A senha precisa ter pelo menos um número';
  if (!/[^A-Za-z0-9]/.test(password)) return 'A senha precisa ter pelo menos um caractere especial (!@#$%...)';
  return null;
}