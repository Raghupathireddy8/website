import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const { name, email, subject, message } = await req.json()

  await resend.emails.send({
    from: 'contact@marketgreeks.com',
    to: 'support@marketgreeks.com',
    subject: subject || 'New Contact Form Inquiry',
    html: `
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Message:</strong><br/>${message}</p>
    `,
  })

  return NextResponse.json({ success: true })
}
