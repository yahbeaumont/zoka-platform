# Modelo de segurança e privacidade

Este documento descreve a postura de segurança da Zoka no nível de design. Ficaram de fora, de propósito, os detalhes que ajudariam a explorar falhas, os endpoints internos e a configuração.

## 1. O que está protegido

| Ativo | Por que importa |
|---|---|
| Identidade e dados de contato do estudante | O público inclui menores; a exposição tem consequência legal e pessoal |
| Conteúdo privado das comunidades | Mensagens, mensagens diretas e material de estudo pertencem a quem escreveu |
| Estado de pagamento e entitlement | Impacto financeiro direto e superfície de fraude |
| Credenciais de provider de IA | O abuso seria cobrado da plataforma |
| Registros de moderação | Restritos; contêm trechos e identidades |

## 2. Fronteiras de confiança

1. **Browser para aplicação.** Entrada não confiável, inclusive headers e cookies. Todo valor é validado no servidor.
2. **Aplicação para provider de identidade.** O ID token do Firebase é verificado, nunca aceito como JSON já decodificado.
3. **Aplicação para persistência.** O Admin SDK passa por cima das rules do Firestore, então a aplicação é a autoridade de autorização e as rules são uma segunda fronteira, independente.
4. **Aplicação para providers externos.** Só saída, com credencial guardada em secret store gerenciado e nunca enviada ao cliente.
5. **Aplicação para provider de pagamento.** Webhook de entrada não é confiável até a assinatura ser verificada sobre o corpo bruto.

## 3. Ameaças consideradas

- **Roubo de credencial por injeção de script.** O cookie de sessão HttpOnly impede que script leia a sessão, e toda requisição que muda estado exige token CSRF.
- **Escalação de privilégio por token desatualizado.** O entitlement sai do estado da assinatura em toda operação protegida, e a claim fica só como cache.
- **Bypass de cota e abuso de custo.** Reserva no servidor, janela horária por usuário e cota diária, tudo avaliado antes da chamada ao provider.
- **Prompt injection contra o tutor.** Classificação de entrada, isolamento de instrução e sanitização de saída. O risco residual continua existindo e está documentado assim.
- **Acesso a dado de outro tenant.** O serviço resolve associação e papel antes de qualquer leitura, e as rules ficam fechadas por padrão.
- **Falsificação e replay de webhook.** Verificação de assinatura sobre o corpo bruto, deduplicação de evento e aplicação idempotente.
- **Tomada de conta por vinculação de identidade.** O produto recusa fusão automática e exige prova da credencial existente antes de vincular.
- **Dado sensível em log.** O log guarda identificador e código, não payload, e nunca registra corpo de resposta de provider.

## 4. Controles implementados

**Sessão.** Cookie de sessão opaco, HttpOnly, Secure, SameSite. O logout revoga no servidor. Token CSRF validado em mutação.

**Identidade.** A senha fica com o provider de identidade. O CPF é guardado só como hash com salt, para comparação de igualdade, e como HMAC, para busca no servidor; a chave do HMAC não chega ao cliente. Área protegida exige e-mail verificado.

**Autorização.** Toda rota protegida resolve ator, recurso e papel. As rules do Firestore repetem a checagem. Operação administrativa exige a claim de papel e nova checagem no servidor, não só um botão escondido.

**Pagamentos.** Checkout hospedado, então dado de cartão nunca passa pela plataforma. O preço é validado contra um catálogo no servidor antes de conceder entitlement. Webhook é verificado e deduplicado.

**IA.** A chave de provider existe só no runtime do servidor. A requisição é normalizada, a resposta é sanitizada, e bloqueio de política vira um erro de cliente específico, para a interface preservar o rascunho e explicar que a cota não foi consumida.

**Telemetria.** O analytics só entra depois de consentimento explícito, com caminho anonimizado e sem identificador. Métrica de produto é agregada.

**Secrets.** Lidos por referência de um secret store gerenciado em runtime. Nenhum secret é commitado, logado, devolvido ao cliente ou escrito em relatório.

## 5. O que não está afirmado

Este repositório não declara conformidade legal, certificação, resultado de pentest nem segurança absoluta. O produto aplica minimização de dados, consentimento e moderação porque o público exige, mas a avaliação jurídica de base legal, consentimento parental e retenção fica fora do código e fora deste documento. Tratamento de dado de menor é requisito de produto, não problema de compliance resolvido.

Os filtros do tutor reduzem o risco de prompt injection e de saída insegura. Não eliminam, e o produto avisa o usuário para não compartilhar dado pessoal na conversa.

## 6. Como reportar

Problema de segurança deve ser reportado em privado ao mantenedor, pelo contato no perfil do GitHub. Não abra issue pública para uma vulnerabilidade suspeita.
