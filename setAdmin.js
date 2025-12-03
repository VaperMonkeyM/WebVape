import admin from "firebase-admin";
import fs from "fs";

// Carga de credenciales
const serviceAccount = JSON.parse(
  fs.readFileSync("./serviceAccountKey.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uid = "UFi50xUaNTaWOFSwxXXdNJ4hQPE3"; // <-- MUY IMPORTANTE

admin
  .auth()
  .setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log("✔️ Usuario convertido en ADMIN REAL");
    process.exit();
  })
  .catch((err) => {
    console.error("❌ ERROR:", err);
  });
