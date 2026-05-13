import { Resend } from 'resend'

let resendInstance: Resend | null = null

function getResend() {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY
    
    // Check if key is missing or is the placeholder from .env.local
    if (!apiKey || apiKey === 'your_resend_api_key') {
      // During build, we might not have the key. Return a proxy or throw only at runtime.
      console.warn('RESEND_API_KEY is missing or using placeholder. Emails will not be sent.')
      // Create a dummy object to prevent crashes if something calls it but doesn't await it? 
      // Actually, better to just return a dummy that throws when used.
      return {
        emails: {
          send: async () => {
            throw new Error('Cannot send email: RESEND_API_KEY is missing or invalid.')
          }
        }
      } as unknown as Resend
    }
    
    resendInstance = new Resend(apiKey)
  }
  return resendInstance
}

export interface StockAlertParams {
  productName: string
  currentStock: number
  minStock: number
  supplierName: string
  deliveryDays: number
  purchaseUrl: string
  unit: string
}

export async function sendStockAlert(params: StockAlertParams) {
  const { productName, currentStock, minStock, supplierName, deliveryDays, purchaseUrl, unit } = params

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F4F2ED;font-family:'Inter','Helvetica Neue',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F2ED;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;border:1px solid #C5C0B1;">
        <!-- Header -->
        <tr>
          <td style="background:#602460;height:48px;text-align:center;padding:0 24px;">
            <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:3px;">MERCURE HOTELS</span>
          </td>
        </tr>
        <!-- Alert tag -->
        <tr>
          <td style="padding:24px 32px 8px;">
            <div style="background:#FEF3C7;border-left:4px solid #D97706;padding:12px 16px;border-radius:4px;font-size:14px;color:#92400E;">
              ⚠️ <strong>Alerte stock bas</strong> — Action requise
            </div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:16px 32px 24px;">
            <h2 style="color:#3D1640;margin:0 0 16px;font-size:18px;">${productName}</h2>
            <table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #C5C0B1;border-radius:6px;font-size:14px;">
              <tr style="background:#DFDBCF;">
                <td style="font-weight:600;color:#3D1640;padding:8px 12px;">Donnée</td>
                <td style="font-weight:600;color:#3D1640;padding:8px 12px;">Valeur</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;color:#602460;font-weight:500;">Stock actuel</td>
                <td style="padding:8px 12px;color:#E8003D;font-weight:700;">${currentStock} ${unit}</td>
              </tr>
              <tr style="background:#F4F2ED;">
                <td style="padding:8px 12px;color:#602460;font-weight:500;">Seuil minimum</td>
                <td style="padding:8px 12px;">${minStock} ${unit}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;color:#602460;font-weight:500;">Fournisseur</td>
                <td style="padding:8px 12px;">${supplierName}</td>
              </tr>
              <tr style="background:#F4F2ED;">
                <td style="padding:8px 12px;color:#602460;font-weight:500;">Délai livraison</td>
                <td style="padding:8px 12px;">${deliveryDays} jour(s)</td>
              </tr>
            </table>
            ${purchaseUrl ? `
            <div style="text-align:center;margin-top:24px;">
              <a href="${purchaseUrl}" style="background:#602460;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:14px;display:inline-block;">
                Commander maintenant →
              </a>
            </div>` : ''}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#DFDBCF;padding:16px 32px;text-align:center;">
            <p style="color:#3D1640;font-size:12px;margin:0;">
              Mercure Hotels — Système de gestion opérationnelle<br>
              ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return getResend().emails.send({
    from: `Mercure Operations <${process.env.RESEND_FROM_EMAIL ?? 'operations@mercure-hotels.com'}>`,
    to: [process.env.ALERT_EMAIL_TO ?? 'gm@mercure-hotels.com'],
    subject: `⚠️ Stock bas — ${productName}`,
    html,
  })
}
