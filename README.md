# Spider Network V2

Arquivos separados:
- `index.html`: estrutura do site
- `style.css`: visual
- `app-base.js`: funções iniciais e loading
- `app.js`: Firebase, autenticação, fórum, chat, jogos e ranking
- `spider-upgrades.js`: som, controles mobile, busca no fórum, denúncia e polimentos
- `firestore.rules`: regras fortes para copiar no Firebase Console

Como usar no GitHub Pages:
1. Envie todos os arquivos para o repositório.
2. O arquivo principal precisa se chamar `index.html`.
3. No Firebase Console, cole o conteúdo de `firestore.rules` em Firestore Database > Rules.
4. Restrinja sua API key no Google Cloud/Firebase e deixe App Check ativado.
