const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox'] }
});

// Munculkan QR Code di Termux
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Scan QR Code di atas dengan WhatsApp kamu');
});

client.on('ready', async () => {
    console.log('WhatsApp siap!');

    const daftarNomor = ['62812xxxxxx', '62857xxxxxx']; // Format 62...
    const daftarPesan = [
        "Pesan 1", "Pesan 2", "Pesan 3", "Pesan 4", "Pesan 5",
        "Pesan 6", "Pesan 7", "Pesan 8", "Pesan 9", "Pesan 10"
    ];

    for (let nomor of daftarNomor) {
        let chatId = nomor.includes('@c.us') ? nomor : nomor + '@c.us';
        console.log(`Mengirim ke: ${nomor}`);

        for (let teks of daftarPesan) {
            await client.sendMessage(chatId, teks);
            console.log(`Terkirim: ${teks}`);
            // Jeda 3 detik agar tidak terlalu cepat terdeteksi spam
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    console.log('Semua pesan selesai dikirim!');
});

client.initialize();
