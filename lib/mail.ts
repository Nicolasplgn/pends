// lib/mail.ts
// Futuramente, você pode plugar a biblioteca "resend" ou "nodemailer" aqui.

export async function sendPendingAlertEmail(to: string, taskTitle: string, dueDate: Date) {
    console.log(`[SIMULAÇÃO DE DISPARO DE E-MAIL]`);
    console.log(`Para: ${to}`);
    console.log(`Assunto: ⚠️ Aviso de Pendência: "${taskTitle}"`);
    console.log(`Mensagem: Olá Nicolas, a pendência "${taskTitle}" está agendada para ${dueDate.toLocaleDateString('pt-BR')}. Não esqueça!`);
    
    // Exemplo de integração real com Resend:
    // await resend.emails.send({ from: 'pends@seudominio.com', to, subject: ... });
  }