// Forzar Node.js runtime (NO edge)
export const config = {
  runtime: "nodejs"
};

import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  const { items, modelo, sabor, nombre, instagram, hora, email, isWinner, winnerName, winnerEmail, prize } = req.body;

  // Manejar email de ganador del sorteo
  if (isWinner) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS
        }
      });

      // Email al ganador
      await transporter.sendMail({
        from: `"The King Puff" <${process.env.GMAIL_USER}>`,
        to: winnerEmail,
        subject: "🎉 ¡HAS GANADO EN NUESTRO SORTEO!",
        text: `
¡Enhorabuena ${winnerName}!

🎊 Has sido el afortunado ganador de nuestro sorteo.

🏆 Premio: ${prize}

Ponte en contacto con nosotros para reclamar tu premio:
📸 Instagram: https://www.instagram.com/vaper__monkey/
📍 The King Puff - Marchena, Sevilla

¡Gracias por participar!
The King Puff 🦁💨
        `
      });

      return res.status(200).json({ ok: true, message: "Winner email sent" });
    } catch (err) {
      console.error("Error sending winner email:", err);
      return res.status(500).json({ ok: false, error: "Server error" });
    }
  }

  // Soportar tanto formato antiguo (modelo/sabor) como nuevo (items array)
  let itemsList = [];
  if (items && Array.isArray(items)) {
    itemsList = items;
  } else if (modelo && sabor) {
    itemsList = [{ modelo, sabor }];
  } else {
    return res.status(400).json({ ok: false, error: "Datos incompletos" });
  }

  if (!nombre || !instagram || !email) {
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

    // Formatear items para el email (pickup a DD/MM/YYYY HH:MM)
    function formatPickup(iso) {
      if (!iso) return "";
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${dd}/${mm}/${yyyy} ${hh}:${mins}`;
    }

    const itemsText = itemsList.map((item, i) => {
      const when = item.pickup ? ` — ⏰ ${formatPickup(item.pickup)}` : "";
      return `${i + 1}. 📦 ${item.modelo} - 🍭 ${item.sabor}${when}`;
    }).join("\n");

    // Email al ADMIN
    await transporter.sendMail({
      from: `"The King Puff Bot" <${process.env.GMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `📩 Nueva reserva recibida (${itemsList.length} item${itemsList.length > 1 ? 's' : ''})`,
      text: `
Nueva reserva:

${itemsText}

👤 Cliente: ${nombre}
📸 Instagram: ${instagram}
📧 Email: ${email}

🕐 Hora del pedido: ${hora}
      `
    });

    // Email al CLIENTE
    await transporter.sendMail({
      from: `"The King Puff" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "✅ Reserva confirmada - The King Puff",
      text: `
Hola ${nombre},

¡Tu reserva ha sido confirmada! 🎉

${itemsText}

🕐 Hora del pedido: ${hora}

¡Ya lo hemos reservado para ti! Pasate cuando puedas. 😜

C/Plaza Santa Maria, 26, 41620 Marchena, Sevilla

Gracias por tu compra,
The King Puff 🦁💨
      `
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error enviando email:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
