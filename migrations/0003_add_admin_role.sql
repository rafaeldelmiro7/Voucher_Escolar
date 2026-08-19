-- Marca usuários com acesso geral (todas as unidades escolares + loja),
-- sem precisar alterar a constraint CHECK de "role" (o papel efetivo 'admin'
-- é resolvido em tempo de login a partir desta flag).
ALTER TABLE usuarios ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
