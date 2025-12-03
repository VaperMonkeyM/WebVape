// Forzar Node.js runtime (NO edge)
export const config = {
  runtime: "nodejs"
};

import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  const { modelo, sabor, nombre, instagram, hora } = req.body;

  if (!modelo || !sabor || !nombre || !instagram) {
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

🕐 Hora del pedido: ${hora}
      `
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error enviando email:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
