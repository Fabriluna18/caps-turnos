require('dotenv').config();
const nodemailer = require('nodemailer');

const hayConfiguracion = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const transporte = hayConfiguracion
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

// Sin configuración de SMTP, el mail se imprime en la consola (modo desarrollo)
async function enviarMail({ para, asunto, texto }) {
  if (!transporte) {
    console.log('\n📧 [MODO DESARROLLO: no hay SMTP configurado, el mail no se envía]');
    console.log(`Para: ${para}\nAsunto: ${asunto}\n\n${texto}\n`);
    return;
  }
  await transporte.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: para,
    subject: asunto,
    text: texto,
  });
}

module.exports = { enviarMail };