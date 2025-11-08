module.exports = {
  apps: [
    {
      name: 'ramay-swalayan',
      script: 'npm',
      args: 'start',

      // Restart otomatis jika aplikasi crash
      autorestart: true,

      // Jangan pantau perubahan file
      watch: false,

      // --- RESTART OTOMATIS SETIAP HARI JAM 00:00 ---
      // Pola cron '0 0 * * *' berarti "jalankan pada menit ke-0, jam ke-0, setiap hari".
      cron_restart: '0 0 * * *',
    }
  ]
};
