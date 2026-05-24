console.debug = () => {};
console.info = () => {};
console.warn = () => {};

const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, encoding, callback) => {
    const str = chunk.toString();
    if (str.includes('Closing session')) return;
    if (str.includes('SessionEntry')) return;
    return originalStdoutWrite(chunk, encoding, callback);
};

const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    DisconnectReason,
    Browsers
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const readline = require('readline');

const delay = ms => new Promise(res => setTimeout(res, ms));

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (text) => new Promise(resolve => rl.question(text, resolve));

const listPesan = [
    "Halo, apa kabar kamu", "Bagaimana harimu?", "Tanya dong makan terenak di semarang apa",
    "Aku Pengen Kerja Tapi Binggu Udah Lamar Sana Sini Lum terima", "Ada Solusi biar bisa dapat kerja gaji 3juta",
    "Aku Pikir Kamu Suka Di Pantai", "Jarak Liburan Ke Dieng Berapa Lama Ya", "Kalo Dari Kendal Ke sana",
    "Makasih Banyak ya Infonya", "Bahagia Banget Bisa bertemen sama Kamu", "Eh iya, cuaca di sana lagi mendung nggak?",
    "Lagi sibuk apa sekarang kalau boleh tahu?", "Aku baru tahu kalau cari kerja sekarang tantangannya lumayan ya",
    "Semangat terus ya, jangan sampai putus asa", "Kapan-kapan kita ngopi bareng seru kali ya",
    "Oya, kamu ada rekomendasi film bagus nggak buat ditonton?", "Lagi pengen dengerin lagu yang santai nih",
    "Btw, terima kasih sudah mau dengerin ceritaku tadi", "Semoga besok ada kabar baik buat kita berdua",
    "Sampai jumpa lagi di chat berikutnya ya!"
];

let isConnected = false;
let globalSock = null; // Menyimpan instance socket agar bisa diakses terminal perintah

async function sendWithRetry(sock, jid, content, maxRetry = 3) {
    let attempt = 0;
    while (attempt < maxRetry) {
        if (!isConnected) return false;
        try {
            await sock.sendPresenceUpdate('composing', jid);
            await delay(Math.floor(Math.random() * 1000) + 1000); 
            await sock.sendMessage(jid, content);
            return true;
        } catch (e) {
            attempt++;
            if (attempt >= maxRetry) return false;
            await delay(Math.pow(2, attempt) * 1000);
        }
    }
    return false;
}

async function runSpamTask(sock, targetJid) {
    console.log(`\n[START] Menjalankan bom pesan ke target: ${targetJid}`);
    
    for (let i = 0; i < listPesan.length; i++) {
        if (!isConnected) {
            console.log(`[STOP] Dihentikan karena koneksi bot terputus.`);
            return;
        }

        const ok = await sendWithRetry(sock, targetJid, { text: listPesan[i] });
        if (ok) {
            console.log(`[OK] Pesan ke-${i + 1} terkirim.`);
        } else {
            console.log(`[FAIL] Pesan ke-${i + 1} gagal.`);
        }

        if (i < listPesan.length - 1) {
            // Jeda berkisar di 45 detik (Rentang aman 40 - 50 detik)
            const jedaAcak = Math.floor(Math.random() * 10000) + 40000; 
            console.log(`Menunggu ${Math.round(jedaAcak/1000)} detik...`);
            await delay(jedaAcak);
        }
    }
    console.log(`[DONE] Seluruh 20 pesan selesai dikirim!\n`);
    tungguPerintahTermux(); // Buka kembali input terminal setelah selesai
}

// Fungsi pembaca perintah dari terminal Termux
function tungguPerintahTermux() {
    rl.question('Termux-Input> ', (input) => {
        const cmd = input.trim();

        if (cmd.startsWith('!kerjayo')) {
            if (!isConnected || !globalSock) {
                console.log("[ERROR] Bot belum terhubung ke WhatsApp. Silakan tunggu.");
                tungguPerintahTermux();
                return;
            }

            const args = cmd.split(' ');
            const nomorTarget = args[1];

            if (!nomorTarget) {
                console.log("[ERROR] Format salah! Gunakan perintah: !kerjayo 628xxxxxxxx");
                tungguPerintahTermux();
                return;
            }

            // Merapikan format nomor input
            let nomorBersih = nomorTarget.replace(/[^0-9]/g, '');
            if (nomorBersih.startsWith('08')) {
                nomorBersih = '62' + nomorBersih.slice(1);
            }

            const targetJid = `${nomorBersih}@s.whatsapp.net`;
            
            // Jalankan pengiriman pesan
            runSpamTask(globalSock, targetJid).catch(err => console.error(err));
        } else {
            if (cmd !== '') {
                console.log(`[!] Perintah "${cmd}" tidak dikenal. Gunakan: !kerjayo [nomor]`);
            }
            tungguPerintahTermux();
        }
    });
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        browser: Browsers.ubuntu('Chrome'),
    });

    globalSock = sock; // Oper ke variabel global agar bisa dipakai fungsi terminal
    sock.ev.on('creds.update', saveCreds);

    if (!sock.authState.creds.registered) {
        const nomor = await question('Nomor Bot Anda (628xxx): ');
        const code = await sock.requestPairingCode(nomor);
        console.log(`Pairing code: ${code}`);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            isConnected = false;
            const harusReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus. Menghubungkan ulang...');
            if (harusReconnect) startBot();
        }
        if (connection === 'open') {
            isConnected = true;
            console.log('\n=========================================');
            console.log(' BOT TERHUBUNG DAN SIAP DI CONTROL!');
            console.log(' Jalankan perintah langsung di bawah ini.');
            console.log(' Contoh: !kerjayo 628123456789');
            console.log('=========================================\n');
            tungguPerintahTermux(); // Mulai aktifkan pembaca perintah Termux
        }
    });
}

startBot();
