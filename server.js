import express from 'express';

const app = express();
app.use((req, res, next) => {
  // L'interfaccia è caricata dall'app Android e può avere origine file:// (null).
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '20kb' }));

const instructions = `Sei Conforto, un assistente di supporto emotivo in italiano. Ascolta con empatia, rifletti in modo semplice ciò che la persona racconta, fai una domanda alla volta e proponi piccoli passi pratici senza giudicare. Non diagnosticare, non presentarti come psicologo e non sostituire una terapia. Non incoraggiare dipendenza dall'assistente. Se la persona esprime rischio imminente di farsi del male o fare male a qualcuno, invita a contattare subito i servizi di emergenza locali e una persona fidata; chiedi se si trova in pericolo immediato. Non promettere segretezza assoluta.`;

app.get('/health', (_req, res) => res.json({ ok: true }));
app.post('/chat', async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-12) : [];
  if (!message || message.length > 4000) return res.status(400).json({ error: 'Messaggio non valido.' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'Il servizio IA non è ancora configurato.' });
  const safeHistory = history.filter(m => ['user', 'assistant'].includes(m?.role) && typeof m?.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-6-sol', instructions, input: [...safeHistory, { role: 'user', content: message }], max_output_tokens: 500 })
    });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: 'Il servizio IA non è disponibile al momento.' });
    const text = (data.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n').trim();
    if (!text) return res.status(502).json({ error: 'Non ho ricevuto una risposta. Riprova tra poco.' });
    return res.json({ reply: text });
  } catch {
    return res.status(502).json({ error: 'Impossibile contattare il servizio IA.' });
  }
});

const port = Number(process.env.PORT) || 8787;
app.listen(port, '0.0.0.0', () => console.log(`Server Conforto attivo sulla porta ${port}`));
