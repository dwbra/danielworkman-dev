import type { APIRoute } from 'astro';

type ContactEnv = App.Locals['runtime']['env'];

type TurnstileResponse = {
  success: boolean;
  'error-codes'?: string[];
};

type ContactPayload = {
  name: string;
  email: string;
  message: string;
};

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const RESEND_EMAIL_URL = 'https://api.resend.com/emails';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (body: Record<string, unknown>, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init?.headers,
    },
  });

const valueFromForm = (data: FormData, key: string) => {
  const value = data.get(key);

  return typeof value === 'string' ? value.trim() : '';
};

const getClientIp = (request: Request) =>
  request.headers.get('CF-Connecting-IP') ||
  request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim();

const validatePayload = (payload: ContactPayload) => {
  if (!payload.name || !payload.email || !payload.message) {
    return 'Please complete all fields.';
  }

  if (payload.name.length > 120) {
    return 'Please use a shorter name.';
  }

  if (!emailPattern.test(payload.email) || payload.email.length > 254) {
    return 'Please enter a valid email address.';
  }

  if (payload.message.length > 4000) {
    return 'Please keep your message under 4000 characters.';
  }

  return null;
};

const verifyTurnstile = async (token: string, request: Request, env: ContactEnv) => {
  const secret = env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    throw new Error('TURNSTILE_SECRET_KEY is not configured');
  }

  const verification = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      secret,
      response: token,
      remoteip: getClientIp(request),
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!verification.ok) {
    throw new Error(`Turnstile verification failed with status ${verification.status}`);
  }

  return verification.json() as Promise<TurnstileResponse>;
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return replacements[character];
  });

const sendContactEmail = async (payload: ContactPayload, env: ContactEnv) => {
  const apiKey = env.RESEND_API_KEY;
  const to = env.CONTACT_TO_EMAIL;
  const from = env.CONTACT_FROM_EMAIL;

  if (!apiKey || !to || !from) {
    throw new Error('RESEND_API_KEY, CONTACT_TO_EMAIL, and CONTACT_FROM_EMAIL must be configured');
  }

  const subject = `Portfolio contact from ${payload.name}`;
  const text = [
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    '',
    payload.message,
  ].join('\n');

  const html = `
    <p><strong>Name:</strong> ${escapeHtml(payload.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(payload.email)}</p>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(payload.message).replace(/\n/g, '<br>')}</p>
  `;

  const response = await fetch(RESEND_EMAIL_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'user-agent': 'danielworkman-dev-contact-form',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html,
      reply_to: payload.email,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend send failed with status ${response.status}: ${errorBody}`);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const acceptsJson =
    request.headers.get('accept')?.includes('application/json') ||
    request.headers.get('x-requested-with') === 'fetch';

  const fail = (message: string, status = 400) =>
    acceptsJson
      ? json({ message }, { status })
      : Response.redirect(new URL(`/#contact?contact=error`, request.url), 303);

  try {
    const data = await request.formData();
    const turnstileToken = valueFromForm(data, 'cf-turnstile-response');
    const payload = {
      name: valueFromForm(data, 'name'),
      email: valueFromForm(data, 'email'),
      message: valueFromForm(data, 'message'),
    };

    const validationError = validatePayload(payload);

    if (validationError) {
      return fail(validationError);
    }

    if (!turnstileToken) {
      return fail('Please complete the verification challenge.');
    }

    const turnstile = await verifyTurnstile(turnstileToken, request, locals.runtime.env);

    if (!turnstile.success) {
      console.warn('Turnstile validation rejected contact submission', turnstile['error-codes']);

      return fail('Verification failed. Please try again.');
    }

    await sendContactEmail(payload, locals.runtime.env);

    return acceptsJson
      ? json({ message: 'Thanks, your message has been sent.' })
      : Response.redirect(new URL('/#contact?contact=success', request.url), 303);
  } catch (error) {
    console.error('Contact form submission failed', error);

    return fail('Something went wrong sending your message. Please try again.', 500);
  }
};
