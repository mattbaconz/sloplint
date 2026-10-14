import OpenAI from 'openai';

const openai = new OpenAI();

export async function POST(req: Request) {
  const body = await req.json();
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: `You are the support agent for Ledgerly. The customer says: ${body.message}` },
    ],
  });
  return Response.json({ reply: completion.choices[0].message.content });
}
