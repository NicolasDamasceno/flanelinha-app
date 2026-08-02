namespace api.Security
{
    public static class PasswordHasher
    {
        public static string Hash(string senha)
        {
            return BCrypt.Net.BCrypt.HashPassword(senha);
        }

        public static bool Verify(string senha, string hash)
        {
            try
            {
                return BCrypt.Net.BCrypt.Verify(senha, hash);
            }
            catch
            {
                // Hash armazenado é inválido/legado (texto puro, vazio, nulo, malformado) — trata como senha não confere.
                return false;
            }
        }
    }
}
