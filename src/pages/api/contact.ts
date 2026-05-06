import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.formData();
    const name = data.get('name');
    const email = data.get('email');
    const message = data.get('message');

    // Here you would typically send an email or save to a database
    // For now, we'll just log it and return success
    console.log(`Message from ${name} (${email}): ${message}`);

    return new Response(
      JSON.stringify({
        message: 'Success!'
      }),
      { status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        message: 'Error processing request'
      }),
      { status: 500 }
    );
  }
};
