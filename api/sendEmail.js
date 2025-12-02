import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Método no permitido" });

  const { modelo, sabor, nombre, instagram } = req.body;

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS, // contraseña de APP
      },
    });

    const info = await transporter.sendMail({
      from: `"Vaper Monkey" <${process.env.GMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: "Nueva reserva de vaper",
      text: `
Nueva reserva:
Modelo: ${modelo}
Sabor: ${sabor}
Nombre: ${nombre}
Instagram: ${instagram}
      `,
    });

    return res.status(200).json({ ok: true, info });

  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
