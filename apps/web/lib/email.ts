import { Resend } from "resend"

const DEFAULT_FROM = "ContaChile <noreply@contachile.cl>"

interface PasswordResetEmailParams {
  to: string
  /** Link de Better Auth: /api/auth/reset-password/{token}?callbackURL=/reset-password */
  url: string
  userName?: string | null
}

function resetPasswordHtml({ url, userName }: PasswordResetEmailParams): string {
  const greeting = userName ? `Hola ${userName},` : "Hola,"
  return `
  <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; color: #1f1a17;">
    <h1 style="font-size: 20px; margin-bottom: 16px;">Restablece tu contraseña</h1>
    <p style="font-size: 14px; line-height: 1.6;">${greeting}</p>
    <p style="font-size: 14px; line-height: 1.6;">
      Recibimos una solicitud para restablecer la contraseña de tu cuenta ContaChile.
      Haz clic en el botón para elegir una nueva contraseña. Este enlace vence en 1 hora.
    </p>
    <p style="margin: 24px 0;">
      <a href="${url}" style="background:#6b1f2a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:4px;font-size:14px;display:inline-block;">
        Restablecer contraseña
      </a>
    </p>
    <p style="font-size: 12px; color: #6b645f; line-height: 1.6;">
      Si no solicitaste esto, puedes ignorar este correo: tu contraseña no cambiará.
    </p>
    <p style="font-size: 12px; color: #6b645f; word-break: break-all;">
      O copia este enlace en tu navegador:<br />${url}
    </p>
  </div>`
}

/**
 * Envía el email de restablecimiento de contraseña vía Resend.
 * Sin RESEND_API_KEY (o con el placeholder "test-key") hace no-op y lo registra,
 * para no romper el desarrollo local sin credenciales de correo.
 */
export async function sendPasswordResetEmail(
  params: PasswordResetEmailParams
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || apiKey === "test-key") {
    console.warn(
      "[email] RESEND_API_KEY no configurado — email de reset omitido (no-op).",
      { to: params.to, url: params.url }
    )
    return
  }

  const from = process.env.EMAIL_FROM || DEFAULT_FROM
  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: "Restablece tu contraseña — ContaChile",
    html: resetPasswordHtml(params),
  })

  if (error) {
    throw new Error(`Resend error: ${error.message}`)
  }
}
