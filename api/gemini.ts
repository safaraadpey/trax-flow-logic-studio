declare const process: {
  env: Record<string, string | undefined>
}

const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: { message: 'Method not allowed. Use POST.' } }, 405)
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return json({ error: { message: 'GEMINI_API_KEY is not configured on the server.' } }, 500)
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return json({ error: { message: 'Request body must be valid JSON.' } }, 400)
  }

  try {
    const upstream = await fetch(GEMINI_INTERACTIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    })

    const responseBody = await upstream.text()
    return new Response(responseBody, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return json({ error: { message: 'Unable to reach the Gemini API.' } }, 502)
  }
}
