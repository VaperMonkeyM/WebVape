// Forzar Node.js runtime (NO edge)
export const config = {
  runtime: "nodejs"
};

import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  const { modelo, sabor, nombre, instagram, hora, email } = req.body;

  if (!modelo || !sabor || !nombre || !instagram || !email) {
    return res.status(400).json({ ok: false, error: "Datos incompletos" });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
      }
    });

    // Email al ADMIN
    await transporter.sendMail({
      from: `"Vaper Monkey Bot" <${process.env.GMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: "📩 Nueva reserva recibida",
      text: `
Nueva reserva:

📦 Modelo: ${modelo}
🍭 Sabor: ${sabor}

👤 Cliente: ${nombre}
📸 Instagram: ${instagram}
📧 Email: ${email}

🕐 Hora del pedido: ${hora}
      `
    });

    // Email al CLIENTE
    await transporter.sendMail({
      from: `"Vaper Monkey" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "✅ Reserva confirmada - Vaper Monkey",
      text: `
Hola ${nombre},

¡Tu reserva ha sido confirmada! 🎉

📦 Modelo: ${modelo}
🍭 Sabor: ${sabor}

🕐 Hora del pedido: ${hora}

Nos pondremos en contacto contigo pronto por Instagram: @vaper__monkey

C/Plaza Santa Maria, 26, 41620 Marchena, Sevilla

Gracias por tu compra,
Vaper Monkey 🐒🌴💨
      `
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error enviando email:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
