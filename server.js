const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

app.use(express.static(ROOT, {
  extensions: ['html'],
  maxAge: '1h'
}));

app.get('*', (_req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Spider Moon rodando na porta ${PORT}`);
});
