let _bot: any = null

async function getBot() {
  if (process.env.ENABLE_TELEGRAM !== 'true') return null
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null
  if (!_bot) {
    const { default: TelegramBot } = await import('node-telegram-bot-api')
    _bot = new TelegramBot(token)
  }
  return _bot
}

export async function sendTelegram(chatId: string, message: string) {
  try {
    const bot = await getBot()
    if (!bot) return
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' })
  } catch (e) {
    console.error('[telegram]', e)
  }
}
