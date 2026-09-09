# Instruções para o Claude Code

## Publicação em produção

Quando o usuário (Rafael) pedir para **"publicar"** uma mudança (ou usar termos
equivalentes como "publica isso", "manda pra produção", "sobe pra produção"),
isso significa, sem precisar pedir confirmação adicional:

1. Criar a pull request da branch de trabalho para `main` (se ainda não existir).
2. Mesclar (merge) essa pull request em `main` imediatamente, mesmo sem
   revisão humana prévia.

A `main` é a branch de produção no Cloudflare Pages: todo push nela gera um
deployment de Production automaticamente. Branches de feature geram apenas
deployments de Preview.

Essa regra dispensa a confirmação padrão de "ação difícil de reverter" só
para o merge em si — outras ações destrutivas (force-push, reset --hard,
exclusão de branch/arquivo, etc.) continuam exigindo confirmação normal.
