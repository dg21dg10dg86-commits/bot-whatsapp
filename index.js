import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  })

  sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update

    if (qr) {
      console.log('📲 Escaneie o QR Code abaixo:')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'close') {
      console.log('❌ Conexão fechada, reconectando...')
      startBot()
    }

    if (connection === 'open') {
      console.log('✅ Bot conectado com sucesso!')
    }
  })

  sock.ev.on('creds.update', saveCreds)

  // 🔥 APAGA LINKS E VÍDEOS
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message) return
    if (msg.key.fromMe) return

    const jid = msg.key.remoteJid
    if (!jid.endsWith('@g.us')) return // só grupo

    const sender = msg.key.participant

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ''

    const hasLink = /(https?:\/\/|www\.)/i.test(text)
    const isVideo = !!msg.message.videoMessage

    if (hasLink || isVideo) {
      await sock.sendMessage(jid, {
        delete: {
          remoteJid: jid,
          fromMe: false,
          id: msg.key.id,
          participant: sender
        }
      })

      console.log('🚫 Link ou vídeo apagado')
    }
  })
}

startBot()
