// Handler de GET /hello: responde 200 com "Hello World" em texto puro.
// Ignora query, cabeçalhos e corpo da requisição.
// Rota mantida fora do Swagger de propósito: não acrescente anotação de documentação aqui.
export function helloHandler(req, res) {
  res.status(200).type('text/plain').send('Hello World');
}
