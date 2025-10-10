// hash.js
const bcrypt = require('bcryptjs');

async function generateHash() {
    const password = '12345678'; // <-- غيّر هذا النص لكلمة المرور اللي تبغاها
    const hash = await bcrypt.hash(password, 10); // 10 = قوة التشفير
    console.log('Hashed password:', hash);
}

generateHash();
