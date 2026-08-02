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
            catch (BCrypt.Net.SaltParseException)
            {
                // Registro legado gravado em texto puro antes da adoção de hash — trata como senha inválida.
                return false;
            }
        }
    }
}
