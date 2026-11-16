import http from 'node:http';
import request from 'supertest';
import { createApp } from '../app.js';
import { startServer } from '../server.js';

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

describe('GET /hello', () => {
  it('responde 200 (issue-1 UT-001)', async () => {
    const app = createApp();

    const response = await request(app).get('/hello');

    expect(response.status).toBe(200);
  });

  it('responde com o corpo exato "Hello World", sem quebra de linha (issue-1 UT-002)', async () => {
    const app = createApp();

    const response = await request(app).get('/hello');

    expect(response.text).toBe('Hello World');
  });

  it('responde com Content-Type de texto puro, não JSON (issue-1 UT-003)', async () => {
    const app = createApp();

    const response = await request(app).get('/hello');

    expect(response.headers['content-type']).toMatch(/^text\/plain/);
    expect(response.headers['content-type']).not.toMatch(/json/);
  });

  it('ignora query string hostil e nunca ecoa a entrada (issue-1 UT-004)', async () => {
    const app = createApp();

    const response = await request(app).get('/hello?nome=<script>alert(1)</script>');

    expect(response.status).toBe(200);
    expect(response.text).toBe('Hello World');
    expect(response.text).not.toContain('<script>');
  });

  it('ignora cabeçalhos e corpo JSON enviados na requisição (issue-1 UT-005)', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/hello')
      .set('X-Custom', 'abc')
      .set('Content-Type', 'application/json')
      .send('{"nome":"Ana"}');

    expect(response.status).toBe(200);
    expect(response.text).toBe('Hello World');
  });

  it('responde normalmente a uma query string de 2000 caracteres (issue-1 UT-006)', async () => {
    const app = createApp();
    const longValue = 'a'.repeat(2000);

    const response = await request(app).get(`/hello?q=${longValue}`);

    expect(response.status).toBe(200);
    expect(response.text).toBe('Hello World');
  });

  it('responde 200 sem exigir header Authorization (issue-1 UT-007)', async () => {
    const app = createApp();

    const response = await request(app).get('/hello');

    expect(response.status).toBe(200);
  });

  it('responde de forma idêntica em 5 chamadas sequenciais, sem estado entre elas (issue-1 UT-008)', async () => {
    const app = createApp();

    const responses = [];
    for (let i = 0; i < 5; i += 1) {
      responses.push(await request(app).get('/hello'));
    }

    responses.forEach((response) => {
      expect(response.status).toBe(200);
      expect(response.text).toBe('Hello World');
    });
  });

  it('responde 404 para POST /hello (issue-1 UT-009)', async () => {
    const app = createApp();

    const response = await request(app).post('/hello');

    expect(response.status).toBe(404);
  });

  it('responde 200 "Hello World" com barra final em /hello/ (issue-1 UT-010)', async () => {
    const app = createApp();

    const response = await request(app).get('/hello/');

    expect(response.status).toBe(200);
    expect(response.text).toBe('Hello World');
  });

  it('responde 200 "Hello World" em /Hello, sem distinguir maiúsculas (issue-1 UT-011)', async () => {
    const app = createApp();

    const response = await request(app).get('/Hello');

    expect(response.status).toBe(200);
    expect(response.text).toBe('Hello World');
  });

  it('responde HEAD /hello com 200, texto puro e corpo vazio (issue-1 UT-012)', async () => {
    const app = createApp();

    const response = await request(app).head('/hello');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/plain/);
    expect(response.text ?? '').toBe('');
  });
});

describe('GET /hello no servidor real', () => {
  let openServers = [];

  afterEach(async () => {
    await Promise.all(openServers.map((server) => closeServer(server)));
    openServers = [];
  });

  it('responde 200, texto puro e "Hello World" num servidor real em porta efêmera (issue-1 IT-001)', async () => {
    const server = await startServer(0);
    openServers.push(server);

    const response = await request(server).get('/hello');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/plain/);
    expect(response.text).toBe('Hello World');
  });

  it('responde corretamente a 20 requisições GET /hello simultâneas (issue-1 IT-002)', async () => {
    const server = await startServer(0);
    openServers.push(server);

    const responses = await Promise.all(
      Array.from({ length: 20 }, () => request(server).get('/hello'))
    );

    expect(responses).toHaveLength(20);
    responses.forEach((response) => {
      expect(response.status).toBe(200);
      expect(response.text).toBe('Hello World');
    });
  });

  it('segue respondendo depois que um cliente desconecta no meio da requisição (issue-1 IT-003)', async () => {
    const server = await startServer(0);
    openServers.push(server);
    const { port } = server.address();

    await new Promise((resolve) => {
      const abortedRequest = http.get({ host: '127.0.0.1', port, path: '/hello' });
      abortedRequest.on('error', () => {
        // Erro esperado (ECONNRESET/abort): o cliente desistiu de propósito.
      });
      abortedRequest.on('close', resolve);
      // Desconecta logo depois de enviar a requisição, antes de ler a resposta.
      abortedRequest.on('finish', () => abortedRequest.destroy());
    });

    const response = await request(server).get('/hello');

    expect(response.status).toBe(200);
    expect(response.text).toBe('Hello World');
  });
});
