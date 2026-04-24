import json
import base64
import logging
import os
from io import BytesIO
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_ID = int(os.getenv("ADMIN_ID"))
WEBAPP_URL = os.getenv("WEBAPP_URL")

if not BOT_TOKEN or not ADMIN_ID or not WEBAPP_URL:
    raise ValueError("Faltan variables de entorno. Revisa tu archivo .env")

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Envía un mensaje con un botón inline que abre la mini app."""
    try:
        keyboard = [[
            InlineKeyboardButton(
                text="🛍️ Abrir Wireguard Shop",
                web_app=WebAppInfo(url=WEBAPP_URL)
            )
        ]]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(
            "¡Bienvenido a *Wireguard Shop*!\n"
            "Pulsa el botón de abajo para comprar productos digitales.",
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
        logger.info(f"Comando /start procesado para {update.effective_user.id}")
    except Exception as e:
        logger.error(f"Error en /start: {e}")
        await update.message.reply_text("⚠️ Ocurrió un error. Intenta de nuevo más tarde.")

async def web_app_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Recibe datos enviados con tg.sendData()."""
    user = update.effective_user
    data_str = update.effective_message.web_app_data.data

    try:
        data = json.loads(data_str)
    except json.JSONDecodeError:
        logger.error("Datos recibidos no son JSON válido")
        await update.effective_message.reply_text("❌ Error en los datos enviados.")
        return

    action = data.get('action')
    logger.info(f"Datos recibidos de {user.id} - acción: {action}")

    try:
        if action == 'purchase_with_details':
            await handle_purchase(update, context, data, user)
        elif action == 'manual_send':
            await handle_manual_send(update, context, data, user)
        elif action == 'export_data':
            await handle_export(update, context, data, user)
        else:
            await update.effective_message.reply_text("⚠️ Acción no reconocida.")
    except Exception as e:
        logger.error(f"Error procesando acción {action}: {e}")
        await update.effective_message.reply_text("❌ Error interno del bot.")

async def handle_purchase(update, context, data, user):
    product = data.get('product', {})
    user_info = data.get('user', {})
    payment = data.get('payment', {})
    proof_file_id = payment.get('proofFileId')

    admin_text = (
        f"🛒 *NUEVA COMPRA RECIBIDA*\n\n"
        f"👤 *Cliente:* {user_info.get('name', 'Desconocido')} (`{user.id}`)\n"
        f"📦 *Producto:* {product.get('name', 'Desconocido')}\n"
        f"💰 *Precio:* ${product.get('price', 0):.2f}\n"
        f"💳 *Método:* {payment.get('method', {}).get('name', 'No especificado')}\n"
        f"📄 *Contrato:* {payment.get('contractType', 'No especificado')}\n"
        f"🏷️ *Cupón:* {payment.get('coupon') or 'Ninguno'}\n"
        f"🕒 *Fecha:* {data.get('timestamp', 'Desconocida')}"
    )
    await context.bot.send_message(chat_id=ADMIN_ID, text=admin_text, parse_mode='Markdown')

    if proof_file_id and isinstance(proof_file_id, str):
        try:
            await context.bot.send_photo(
                chat_id=ADMIN_ID,
                photo=proof_file_id,
                caption=f"🧾 Comprobante de pago: {product.get('name')}"
            )
        except Exception as e:
            logger.error(f"Error reenviando comprobante: {e}")

    client_text = (
        f"✅ *¡Compra registrada con éxito!*\n\n"
        f"Has solicitado: *{product.get('name')}*\n"
        f"Monto: *${product.get('price', 0):.2f}*\n\n"
        f"⏳ *Estado:* Esperando validación del administrador.\n"
        f"Por favor, mantente atento a este chat. En breve recibirás tus archivos o credenciales por privado."
    )
    await update.effective_message.reply_text(client_text, parse_mode='Markdown')

async def handle_manual_send(update, context, data, user):
    if user.id != ADMIN_ID:
        await update.effective_message.reply_text("⛔ Acción no permitida.")
        return

    target_id = data.get('target_user_id')
    product = data.get('product', {})
    custom_msg = data.get('custom_message', '')
    attachment_b64 = data.get('attachment')

    if not target_id:
        await update.effective_message.reply_text("❌ Falta el ID del destinatario.")
        return

    try:
        target_id = int(target_id)
        product_info = (
            f"📦 *{product.get('name', 'Producto')}*\n"
            f"_{product.get('description', 'Sin descripción')}_\n"
            f"💵 Precio: ${product.get('price', 0):.2f}\n\n"
            f"{custom_msg}"
        )
        await context.bot.send_message(chat_id=target_id, text=product_info, parse_mode='Markdown')

        if attachment_b64 and isinstance(attachment_b64, str) and attachment_b64.startswith('data:'):
            try:
                header, encoded = attachment_b64.split(',', 1)
                file_bytes = base64.b64decode(encoded)
                bio = BytesIO(file_bytes)
                bio.name = f"archivo_{product.get('name', 'adjunto')[:20]}.bin"
                await context.bot.send_document(chat_id=target_id, document=bio, caption="📎 Archivo adjunto del administrador")
            except Exception as e:
                logger.error(f"Error enviando archivo adjunto: {e}")
                await context.bot.send_message(chat_id=target_id, text="⚠️ Error al enviar el archivo adjunto.")

        await update.effective_message.reply_text(f"✅ Producto enviado a {target_id}.")
    except Exception as e:
        logger.error(f"Error en envío manual: {e}")
        await update.effective_message.reply_text(f"❌ Error al enviar: {e}")

async def handle_export(update, context, data, user):
    if user.id != ADMIN_ID:
        await update.effective_message.reply_text("⛔ Acción no permitida.")
        return
    exported = data.get('data', {})
    await context.bot.send_message(
        chat_id=ADMIN_ID,
        text=f"📊 *Datos exportados:*\n```json\n{json.dumps(exported, indent=2)[:3500]}\n```",
        parse_mode='Markdown'
    )
    await update.effective_message.reply_text("📤 Datos enviados a tu chat privado.")

async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    logger.error(f"Update {update} causó error: {context.error}")

def main():
    app = Application.builder().token(BOT_TOKEN).connect_timeout(30).read_timeout(30).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, web_app_data))
    app.add_error_handler(error_handler)
    logger.info("Bot iniciado. Esperando mensajes...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()