import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const { data, error } = await resend.emails.send({
    from: 'Rede Nex <noreply@nextelecom.net.br>',
    to,
    subject: 'Redefinição de senha — Rede Nex',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0a0f1e;color:#e8f0fe;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <span style="font-size:28px;font-weight:900;color:#e84719;">NEX</span><span style="font-size:28px;font-weight:900;color:#dce8f8;">TELECOM</span>
        </div>
        <h2 style="color:#f0f6ff;font-size:20px;margin-bottom:8px;">Redefinição de senha</h2>
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;">Olá, ${name || 'colaborador(a)'}!</p>
        <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;">
          Recebemos uma solicitação para redefinir a senha da sua conta na <strong style="color:#e8f0fe;">Rede Nex</strong>.
          Clique no botão abaixo para criar uma nova senha. O link é válido por <strong style="color:#e84719;">1 hora</strong>.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#e84719,#c43612);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">
            Redefinir minha senha
          </a>
        </div>
        <p style="color:rgba(255,255,255,0.35);font-size:12px;line-height:1.6;">
          Se você não solicitou a redefinição de senha, ignore este e-mail. Sua senha permanecerá a mesma.
        </p>
        <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:24px 0;"/>
        <p style="color:rgba(255,255,255,0.2);font-size:11px;text-align:center;">
          Rede Nex — Plataforma Corporativa NexTelecom
        </p>
      </div>
    `,
  });
  if (error) throw new Error(error.message);
  return data;
}
